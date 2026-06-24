const ApiError = require("../../shared/utils/ApiError");
const resolveRefId = require("../../shared/utils/resolve-ref-id");
const Ticket = require("./ticket.model");
const { ROLES } = require("../../shared/constants/roles");

const canAccess = (user, ticket) => {
  if (!user || !ticket) {
    return false;
  }

  if (user.role === ROLES.ADMIN) {
    return true;
  }

  const userTeamId = resolveRefId(user.teamId);
  const ticketTeamId = resolveRefId(ticket.teamId);

  if (user.role === ROLES.TEAM_LEAD) {
    return Boolean(userTeamId && userTeamId === ticketTeamId);
  }

  if (user.role === ROLES.AGENT) {
    const assignedToId = resolveRefId(ticket.assignedTo);
    const isAssigned = assignedToId && assignedToId === user._id.toString();
    const isTeamTicket = Boolean(userTeamId && userTeamId === ticketTeamId);
    return isAssigned || isTeamTicket;
  }

  return false;
};

const assertAccess = async (user, ticketId) => {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  if (!canAccess(user, ticket)) {
    throw new ApiError(403, "You do not have access to this ticket");
  }

  return ticket;
};

module.exports = { canAccess, assertAccess };
