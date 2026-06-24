const asyncHandler = require("../../shared/utils/asyncHandler");
const merchantService = require("./merchant.service");

const syncMerchant = asyncHandler(async (req, res) => {
  const merchant = await merchantService.syncMerchant(req.body);

  res.json({
    message: "Merchant synced successfully",
    data: merchant
  });
});

module.exports = { syncMerchant };
