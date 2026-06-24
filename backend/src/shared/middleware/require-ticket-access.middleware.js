const asyncHandler = require("../utils/asyncHandler");
const TicketAccessPolicy = require("../../modules/tickets/ticket-access.policy");

const requireTicketAccess = asyncHandler(async (req, _res, next) => {
  req.ticket = await TicketAccessPolicy.assertAccess(req.user, req.params.id);
  next();
});

module.exports = requireTicketAccess;
