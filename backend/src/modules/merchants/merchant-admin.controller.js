const asyncHandler = require("../../shared/utils/asyncHandler");
const merchantService = require("./merchant.service");

const list = asyncHandler(async (req, res) => {
  const merchants = await merchantService.listMerchants(req.query);
  res.json({ data: merchants });
});

const create = asyncHandler(async (req, res) => {
  const merchant = await merchantService.createByAdmin(req.body);
  res.status(201).json({ message: "Merchant registered", data: merchant });
});

const update = asyncHandler(async (req, res) => {
  const merchant = await merchantService.updateByAdmin(req.params.id, req.body);
  res.json({ message: "Merchant updated", data: merchant });
});

module.exports = { list, create, update };
