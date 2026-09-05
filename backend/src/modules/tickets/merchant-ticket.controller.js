const asyncHandler = require("../../shared/utils/asyncHandler");
const ticketService = require("./ticket.service");

const tenantCtx = (req) => ({ tenantId: req.tenant._id });

const listModules = asyncHandler(async (req, res) => {
  const modules = await ticketService.listModulesForMerchant(req.merchant);
  res.json({ data: modules });
});

const create = asyncHandler(async (req, res) => {
  const ticket = await ticketService.createForMerchant(req.merchant, req.body, tenantCtx(req));
  res.status(201).json({ message: "Ticket created", data: ticket });
});

const list = asyncHandler(async (req, res) => {
  const tickets = await ticketService.listForMerchant(req.merchant._id, {
    tenantId: req.merchant.tenantId || req.tenant._id
  });
  res.json({ data: tickets });
});

const getById = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getForMerchant(req.merchant._id, req.params.id, {
    tenantId: req.merchant.tenantId || req.tenant._id
  });
  res.json({ data: ticket });
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await ticketService.getStatsForMerchant(req.merchant._id, {
    tenantId: req.merchant.tenantId || req.tenant._id
  });
  res.json({ data: stats });
});

const closeTicket = asyncHandler(async (req, res) => {
  const lifecycle = require("./ticket-lifecycle.service");
  const ticket = await lifecycle.clientCloseTicket(req.params.id, req.merchant, {
    tenantId: req.merchant.tenantId || req.tenant._id
  });
  res.json({ message: "Ticket closed", data: ticket });
});

const reopenTicket = asyncHandler(async (req, res) => {
  const lifecycle = require("./ticket-lifecycle.service");
  const ticket = await lifecycle.clientReopenTicket(req.params.id, req.merchant, {
    tenantId: req.merchant.tenantId || req.tenant._id,
    reason: req.body?.reason
  });
  res.json({ message: "Ticket reopened", data: ticket });
});

const getSla = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getForMerchant(req.merchant._id, req.params.id, {
    tenantId: req.merchant.tenantId || req.tenant._id
  });
  const slaService = require("./sla.service");
  const sm = await slaService.getServiceManagement(ticket.tenantId);
  const plain = ticket.toObject ? ticket.toObject() : ticket;
  res.json({ data: slaService.attachSlaPublicView(plain, sm) });
});

const listCustomerPriorities = asyncHandler(async (req, res) => {
  const slaService = require("./sla.service");
  const sm = await slaService.getServiceManagement(req.merchant.tenantId || req.tenant._id);
  const codes = slaService.customerAllowedPriorities(sm);
  const priorities = (sm.priorities || []).filter((p) => codes.includes(p.code));
  res.json({ data: priorities });
});

module.exports = {
  listModules,
  create,
  list,
  getById,
  getStats,
  closeTicket,
  reopenTicket,
  getSla,
  listCustomerPriorities
};
