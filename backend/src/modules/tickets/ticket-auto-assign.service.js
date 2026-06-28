const Ticket = require("./ticket.model");
const User = require("../users/user.model");
const Team = require("../teams/team.model");
const notificationManager = require("../notifications/notification-manager.service");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const { ROLES } = require("../../shared/constants/roles");
const { ACTIVE_TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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

const pickAvailableAgent = async (teamId) => {
  const agents = await User.find({
    teamId,
    role: ROLES.AGENT,
    isActive: true
  }).select("firstName lastName email");

  if (!agents.length) {
    return { agent: null, reason: "no_agents" };
  }

  const activeCounts = await countActiveTicketsByAgent(agents.map((agent) => agent._id));
  const idleAgents = agents.filter((agent) => !(activeCounts.get(agent._id.toString()) > 0));

  if (!idleAgents.length) {
    return { agent: null, reason: "all_busy" };
  }

  return {
    agent: idleAgents[Math.floor(Math.random() * idleAgents.length)],
    reason: null
  };
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
      ? "All agents on your team currently have open tickets, so this ticket was not auto-assigned."
      : "There are no active agents on your team, so this ticket was not auto-assigned.";

  const html = `
    <p>Hi ${escapeHtml(lead.firstName)},</p>
    <p>Ticket <strong>${escapeHtml(ticket.ticketNumber)}</strong> — "${escapeHtml(ticket.subject)}" is waiting in your team queue.</p>
    <p>${reasonLine} Please assign it to an agent or to yourself when you are ready.</p>
    <p><a href="${ticketUrl}">Open ticket in ELVA Support</a></p>
    <p>— ELVA Support</p>
  `;

  const result = await notificationManager.sendEmail({
    to: lead.email,
    subject: `[Action needed] Ticket ${ticket.ticketNumber} needs assignment`,
    html
  });

  if (!result.success) {
    logger.warn("Failed to notify team lead about unassigned ticket", {
      ticketNumber: ticket.ticketNumber,
      teamLeadEmail: lead.email,
      error: result.error
    });
  }
};

const autoAssignOnCreate = async (ticket) => {
  const conversationService = require("../conversations/conversation.service");
  const team = await Team.findById(ticket.teamId).select("teamLeadId name");
  if (!team) {
    return ticket;
  }

  const { agent, reason } = await pickAvailableAgent(team._id);

  if (agent) {
    ticket.assignedTo = agent._id;
    ticket.assignedAt = new Date();
    await ticket.save();

    const agentName = `${agent.firstName} ${agent.lastName}`;
    await conversationService.addSystemEvent(ticket._id, `Ticket auto-assigned to ${agentName}`);

    await logAudit({
      entityType: ENTITY_TYPES.TICKET,
      entityId: ticket._id,
      action: AUDIT_ACTIONS.TICKET_ASSIGNED,
      actorType: ACTOR_TYPES.SYSTEM,
      actorName: "Auto-assign",
      metadata: {
        ticketNumber: ticket.ticketNumber,
        assignedTo: agent._id.toString(),
        assignedToName: agentName,
        autoAssigned: true
      }
    });

    return ticket;
  }

  const queueMessage =
    reason === "all_busy"
      ? "All agents are currently busy — awaiting team lead assignment."
      : "No agents available — awaiting team lead assignment.";

  await conversationService.addSystemEvent(ticket._id, queueMessage);
  await notifyTeamLeadUnassigned(ticket, team, reason);

  return ticket;
};

module.exports = { autoAssignOnCreate, pickAvailableAgent };
