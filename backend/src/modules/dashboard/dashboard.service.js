const Ticket = require("../tickets/ticket.model");
const User = require("../users/user.model");
const Team = require("../teams/team.model");
const {
  TICKET_STATUSES,
  ACTIVE_TICKET_STATUSES
} = require("../../shared/constants/ticket-statuses");
const { ROLES } = require("../../shared/constants/roles");
const ApiError = require("../../shared/utils/ApiError");
const resolveRefId = require("../../shared/utils/resolve-ref-id");

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const getAverageResolutionTimeHours = async () => {
  const resolvedTickets = await Ticket.find({
    status: TICKET_STATUSES.RESOLVED
  }).select("createdAt updatedAt");

  if (!resolvedTickets.length) {
    return 0;
  }

  const totalMs = resolvedTickets.reduce(
    (sum, ticket) => sum + (new Date(ticket.updatedAt) - new Date(ticket.createdAt)),
    0
  );

  return Math.round((totalMs / resolvedTickets.length / (1000 * 60 * 60)) * 10) / 10;
};

const getAgentMetrics = async (user) => {
  const userId = user._id;
  const todayStart = startOfToday();

  const [assignedTickets, resolvedToday, ticketsCreatedToday, ticketsResolvedToday, averageResolutionTime] =
    await Promise.all([
      Ticket.find({ assignedTo: userId }),
      Ticket.countDocuments({
        assignedTo: userId,
        status: TICKET_STATUSES.RESOLVED,
        updatedAt: { $gte: todayStart }
      }),
      Ticket.countDocuments({ createdAt: { $gte: todayStart } }),
      Ticket.countDocuments({
        status: TICKET_STATUSES.RESOLVED,
        updatedAt: { $gte: todayStart }
      }),
      getAverageResolutionTimeHours()
    ]);

  return {
    assignedToMe: assignedTickets.length,
    openTickets: assignedTickets.filter((t) => ACTIVE_TICKET_STATUSES.includes(t.status)).length,
    waitingForCustomer: assignedTickets.filter((t) => t.status === TICKET_STATUSES.WAITING_FOR_CUSTOMER)
      .length,
    resolvedToday,
    ticketsCreatedToday,
    ticketsResolvedToday,
    averageResolutionTime
  };
};

const getTeamWorkload = async (user, teamIdFilter) => {
  let teamId = teamIdFilter;

  if (user.role === ROLES.TEAM_LEAD) {
    if (!user.teamId) {
      throw new ApiError(400, "You are not assigned to a team");
    }
    teamId = resolveRefId(user.teamId);
  }

  if (!teamId && user.role === ROLES.ADMIN) {
    const teams = await Team.find({ isActive: true }).select("name");
    const workloads = [];

    for (const team of teams) {
      const members = await User.find({
        teamId: team._id,
        role: { $in: [ROLES.AGENT, ROLES.TEAM_LEAD] },
        isActive: true
      }).select("firstName lastName");

      for (const member of members) {
        const ticketCount = await Ticket.countDocuments({
          assignedTo: member._id,
          status: { $in: ACTIVE_TICKET_STATUSES }
        });
        workloads.push({
          userId: member._id,
          name: `${member.firstName} ${member.lastName}`,
          teamId: team._id,
          teamName: team.name,
          ticketCount
        });
      }
    }

    return workloads.sort((a, b) => b.ticketCount - a.ticketCount);
  }

  if (!teamId) {
    throw new ApiError(400, "Team id is required");
  }

  const team = await Team.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  const members = await User.find({
    teamId,
    role: { $in: [ROLES.AGENT, ROLES.TEAM_LEAD] },
    isActive: true
  }).select("firstName lastName");

  const workloads = await Promise.all(
    members.map(async (member) => {
      const ticketCount = await Ticket.countDocuments({
        assignedTo: member._id,
        status: { $in: ACTIVE_TICKET_STATUSES }
      });

      return {
        userId: member._id,
        name: `${member.firstName} ${member.lastName}`,
        teamId: team._id,
        teamName: team.name,
        ticketCount
      };
    })
  );

  return workloads.sort((a, b) => b.ticketCount - a.ticketCount);
};

module.exports = { getAgentMetrics, getTeamWorkload };
