const ApiError = require("../../shared/utils/ApiError");
const resolveRefId = require("../../shared/utils/resolve-ref-id");
const Ticket = require("./ticket.model");
const User = require("../users/user.model");
const Team = require("../teams/team.model");
const ticketService = require("./ticket.service");
const conversationService = require("../conversations/conversation.service");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const { ROLES } = require("../../shared/constants/roles");

const validateAssignPermission = (user, ticket) => {
  if (![ROLES.ADMIN, ROLES.TEAM_LEAD].includes(user.role)) {
    throw new ApiError(403, "Only team leads and admins can assign tickets");
  }

  if (user.role === ROLES.TEAM_LEAD) {
    if (!user.teamId || resolveRefId(user.teamId) !== resolveRefId(ticket.teamId)) {
      throw new ApiError(403, "You can only assign tickets within your team");
    }
  }
};

const assignTicket = async (ticketId, userId, assigner) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  validateAssignPermission(assigner, ticket);

  const agent = await User.findById(userId);
  if (!agent || !agent.isActive) {
    throw new ApiError(400, "Agent not found");
  }

  if (![ROLES.AGENT, ROLES.TEAM_LEAD].includes(agent.role)) {
    throw new ApiError(400, "Tickets can only be assigned to agents or team leads");
  }

  if (!agent.teamId || resolveRefId(agent.teamId) !== resolveRefId(ticket.teamId)) {
    throw new ApiError(400, "Agent must belong to the ticket's assigned team");
  }

  const previousAssignee = ticket.assignedTo
    ? await User.findById(ticket.assignedTo).select("firstName lastName")
    : null;

  ticket.assignedTo = agent._id;
  ticket.assignedAt = new Date();
  await ticket.save();

  const assignerName = `${assigner.firstName} ${assigner.lastName}`;
  const agentName = `${agent.firstName} ${agent.lastName}`;
  const message = previousAssignee
    ? `Ticket reassigned from ${previousAssignee.firstName} ${previousAssignee.lastName} to ${agentName} by ${assignerName}`
    : `Ticket assigned to ${agentName} by ${assignerName}`;

  await conversationService.addSystemEvent(ticketId, message);

  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_ASSIGNED,
    actorType: ACTOR_TYPES.AGENT,
    actorId: assigner._id,
    actorName: assignerName,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      assignedTo: agent._id.toString(),
      assignedToName: agentName,
      previousAssignee: previousAssignee
        ? `${previousAssignee.firstName} ${previousAssignee.lastName}`
        : null
    }
  });

  return ticketService.getById(ticketId);
};

const getTeamAgents = async (teamId) => {
  return User.find({
    teamId,
    role: { $in: [ROLES.AGENT, ROLES.TEAM_LEAD] },
    isActive: true
  }).select("firstName lastName email role teamId");
};

module.exports = { assignTicket, getTeamAgents, validateAssignPermission };
