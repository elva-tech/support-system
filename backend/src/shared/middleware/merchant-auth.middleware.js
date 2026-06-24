const ApiError = require("../utils/ApiError");
const merchantService = require("../../modules/merchants/merchant.service");

const merchantAuthenticate = async (req, res, next) => {
  const sessionToken = req.headers["x-merchant-session"];

  if (!sessionToken) {
    return next(new ApiError(401, "Merchant session required"));
  }

  try {
    req.merchant = await merchantService.validateSession(sessionToken, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || ""
    });
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = merchantAuthenticate;
