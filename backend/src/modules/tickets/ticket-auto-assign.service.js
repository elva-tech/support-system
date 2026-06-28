const Ticket = require("./ticket.model");
const User = require("../users/user.model");
const Team = require("../teams/team.model");
const notificationManager = require("../notifications/notification-manager.service");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const { ROLES } = require("../../shared/constants/roles");
const { TICKET_STATUSES, ACTIVE_TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");
const { renderTeamLeadAlertEmail } = require("../notifications/email-templates");

const countActiveTicketsByAgent = async (agentIds) => {
  if (!agentIds.length) {
    return new Map();
  }

  const rows = await Ticket.aggregate([
    {
      $match: {
        assignedTo: { $in: agentIds },
        status: { $in: ACTIVE_TICKET_STATUSES }
      }
    },
    { $group: { _id: "$assignedTo", count: { $sum: 1 } } }
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
};

const getAgentIdleSince = (agent) => agent.availableSince || agent.createdAt || new Date(0);

const pickAvailableAgent = async (teamId) => {
  const agents = await User.find({
    teamId,
    role: ROLES.AGENT,
    isActive: true
  }).select("firstName lastName email availableSince createdAt");

  if (!agents.length) {
    return { agent: null, reason: "no_agents" };
  }

  const activeCounts = await countActiveTicketsByAgent(agents.map((agent) => agent._id));
  const idleAgents = agents.filter((agent) => !(activeCounts.get(agent._id.toString()) > 0));

  if (!idleAgents.length) {
    return { agent: null, reason: "all_busy" };
  }

  idleAgents.sort((a, b) => getAgentIdleSince(a) - getAgentIdleSince(b));

  return {
    agent: idleAgents[0],
    reason: null
  };
};

const refreshAgentAvailability = async (agentId) => {
  if (!agentId) {
    return;
  }

  const activeCount = await Ticket.countDocuments({
    assignedTo: agentId,
    status: { $in: ACTIVE_TICKET_STATUSES }
  });

  if (activeCount === 0) {
    await User.findByIdAndUpdate(agentId, { $set: { availableSince: new Date() } });
  }
};

const assignTicketToAgent = async (ticket, agent, { autoAssigned = false, fromQueue = false } = {}) => {
  const conversationService = require("../conversations/conversation.service");

  ticket.assignedTo = agent._id;
  ticket.assignedAt = new Date();
  await ticket.save();

  const agentName = `${agent.firstName} ${agent.lastName}`;
  const assignMessage = fromQueue
    ? `Ticket auto-assigned from queue to ${agentName} (longest available agent)`
    : autoAssigned
      ? `Ticket auto-assigned to ${agentName}`
      : `Ticket assigned to ${agentName}`;

  await conversationService.addSystemEvent(ticket._id, assignMessage);

  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_ASSIGNED,
    actorType: ACTOR_TYPES.SYSTEM,
    actorName: autoAssigned ? "Auto-assign" : "System",
    metadata: {
      ticketNumber: ticket.ticketNumber,
      assignedTo: agent._id.toString(),
      assignedToName: agentName,
      autoAssigned,
      fromQueue
    },
    skipNotificationEvent: autoAssigned
  });

  return ticket;
};

const notifyTeamLeadUnassigned = async (ticket, team, reason) => {
  if (!team.teamLeadId) {
    logger.warn("Unassigned ticket — team has no lead to notify", {
      ticketNumber: ticket.ticketNumber,
      teamId: team._id.toString(),
      reason
    });
    return;
  }

  const lead = await User.findById(team.teamLeadId).select("email firstName lastName isActive");
  if (!lead?.email || !lead.isActive) {
    return;
  }

  const ticketUrl = `${env.frontendUrl.replace(/\/$/, "")}/tickets/${ticket._id}`;
  const reasonLine =
    reason === "all_busy"
      ? "All agents are currently busy — this ticket is in the queue and will auto-assign when an agent becomes available."
      : "No agents are available — this ticket is awaiting team lead assignment.";

  const result = await notificationManager.sendEmail({
    to: lead.email,
    subject: `[Action needed] Ticket ${ticket.ticketNumber} needs assignment`,
    html: renderTeamLeadAlertEmail({
      firstName: lead.firstName,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      reasonLine: `${reasonLine} You can also assign it manually at any time.`,
      ticketUrl
    })
  });

  if (!result.success) {
    logger.warn("Failed to notify team lead about unassigned ticket", {
      ticketNumber: ticket.ticketNumber,
      teamLeadEmail: lead.email,
      error: result.error
    });
  }
};

const processQueuedTickets = async (teamId) => {
  let assignedCount = 0;

  while (true) {
    const { agent } = await pickAvailableAgent(teamId);
    if (!agent) {
      break;
    }

    const queuedTicket = await Ticket.findOne({
      teamId,
      assignedTo: null,
      status: TICKET_STATUSES.OPEN
    }).sort({ createdAt: 1 });

    if (!queuedTicket) {
      break;
    }

    await assignTicketToAgent(queuedTicket, agent, { autoAssigned: true, fromQueue: true });
    assignedCount += 1;
  }

  if (assignedCount > 0) {
    logger.info("Queued tickets auto-assigned", { teamId: teamId.toString(), assignedCount });
  }

  return assignedCount;
};

const onAgentPotentiallyFreed = async (agentId, teamId) => {
  if (!agentId || !teamId) {
    return 0;
  }

  await refreshAgentAvailability(agentId);
  return processQueuedTickets(teamId);
};

const autoAssignOnCreate = async (ticket) => {
  const conversationService = require("../conversations/conversation.service");
  const team = await Team.findById(ticket.teamId).select("teamLeadId name");
  if (!team) {
    return ticket;
  }

  const { agent, reason } = await pickAvailableAgent(team._id);

  if (agent) {
    await assignTicketToAgent(ticket, agent, { autoAssigned: true });
    return ticket;
  }

  const queueMessage =
    reason === "all_busy"
      ? "All agents are currently busy — ticket queued for auto-assignment when an agent becomes available."
      : "No agents available — awaiting team lead assignment.";

  await conversationService.addSystemEvent(ticket._id, queueMessage);
  await notifyTeamLeadUnassigned(ticket, team, reason);

  return ticket;
};

module.exports = {
  autoAssignOnCreate,
  pickAvailableAgent,
  processQueuedTickets,
  onAgentPotentiallyFreed,
  refreshAgentAvailability
};
