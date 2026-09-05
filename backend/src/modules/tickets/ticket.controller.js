const asyncHandler = require("../../shared/utils/asyncHandler");
const ticketService = require("./ticket.service");
const operationsService = require("./ticket-operations.service");

const tenantCtx = (req) => ({ tenantId: req.tenant._id });

const list = asyncHandler(async (req, res) => {
  const result = await ticketService.listAll(req.user, req.query, tenantCtx(req));
  res.json(result);
});

const listMy = asyncHandler(async (req, res) => {
  const result = await ticketService.listMyTickets(req.user._id, req.query, tenantCtx(req));
  res.json(result);
});

const listTeam = asyncHandler(async (req, res) => {
  const result = await ticketService.listTeamTickets(req.user, req.query, tenantCtx(req));
  res.json(result);
});

const assign = asyncHandler(async (req, res) => {
  const ticket = await operationsService.assignTicket(
    req.params.id,
    req.body.userId,
    req.user,
    tenantCtx(req)
  );
  res.json({ message: "Ticket assigned", data: ticket });
});

const getTeamAgents = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getById(req.params.id, tenantCtx(req));
  operationsService.validateAssignPermission(req.user, ticket);
  const agents = await operationsService.getTeamAgents(
    ticket.teamId._id || ticket.teamId,
    tenantCtx(req)
  );
  res.json({ data: agents });
});

const getById = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getById(req.params.id, tenantCtx(req));
  res.json({ data: ticket });
});

module.exports = { list, listMy, listTeam, assign, getTeamAgents, getById };
