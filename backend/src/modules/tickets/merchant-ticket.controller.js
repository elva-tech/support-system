const asyncHandler = require("../../shared/utils/asyncHandler");
const ticketService = require("./ticket.service");

const listModules = asyncHandler(async (req, res) => {
  const modules = await ticketService.listModulesForMerchant(req.merchant);
  res.json({ data: modules });
});

const create = asyncHandler(async (req, res) => {
  const ticket = await ticketService.createForMerchant(req.merchant, req.body);
  res.status(201).json({ message: "Ticket created", data: ticket });
});

const list = asyncHandler(async (req, res) => {
  const tickets = await ticketService.listForMerchant(req.merchant._id);
  res.json({ data: tickets });
});

const getById = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getForMerchant(req.merchant._id, req.params.id);
  res.json({ data: ticket });
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await ticketService.getStatsForMerchant(req.merchant._id);
  res.json({ data: stats });
});

module.exports = { listModules, create, list, getById, getStats };
