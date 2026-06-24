const asyncHandler = require("../../shared/utils/asyncHandler");
const ticketService = require("./ticket.service");
const operationsService = require("./ticket-operations.service");

const list = asyncHandler(async (req, res) => {
  const result = await ticketService.listAll(req.user, req.query);
  res.json(result);
});

const listMy = asyncHandler(async (req, res) => {
  const result = await ticketService.listMyTickets(req.user._id, req.query);
  res.json(result);
});

const listTeam = asyncHandler(async (req, res) => {
  const result = await ticketService.listTeamTickets(req.user, req.query);
  res.json(result);
});

const assign = asyncHandler(async (req, res) => {
  const ticket = await operationsService.assignTicket(req.params.id, req.body.userId, req.user);
  res.json({ message: "Ticket assigned", data: ticket });
});

const getTeamAgents = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getById(req.params.id);
  operationsService.validateAssignPermission(req.user, ticket);
  const agents = await operationsService.getTeamAgents(ticket.teamId._id || ticket.teamId);
  res.json({ data: agents });
});

const getById = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getById(req.params.id);
  res.json({ data: ticket });
});

module.exports = { list, listMy, listTeam, assign, getTeamAgents, getById };
