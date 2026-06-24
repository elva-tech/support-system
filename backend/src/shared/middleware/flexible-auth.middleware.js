const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const env = require("../../config/env");
const User = require("../../modules/users/user.model");
const merchantService = require("../../modules/merchants/merchant.service");

const flexibleAuth = async (req, res, next) => {
  const merchantToken = req.headers["x-merchant-session"];
  const authHeader = req.headers.authorization;

  if (merchantToken) {
    try {
      req.merchant = await merchantService.validateSession(merchantToken, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || ""
      });
      req.authType = "merchant";
      return next();
    } catch (error) {
      return next(error);
    }
  }

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(decoded.sub)
        .select("-password")
        .populate("teamId", "name")
        .populate("applicationIds", "name code");

      if (!user || !user.isActive) {
        return next(new ApiError(401, "Invalid or inactive account"));
      }

      req.user = user;
      req.authType = "agent";
      return next();
    } catch {
      return next(new ApiError(401, "Invalid or expired token"));
    }
  }

  return next(new ApiError(401, "Authentication required"));
};

module.exports = flexibleAuth;
