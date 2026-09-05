const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const env = require("../../config/env");
const User = require("../../modules/users/user.model");
const { PLATFORM_IDENTITY_TYPE } = require("../constants/platform");
const { isUserLoginAllowed } = require("../constants/user-lifecycle");

/**
 * Tenant staff JWT authentication.
 * Rejects Platform Admin tokens (identityType === PLATFORM_ADMIN).
 * Legacy tenant JWTs ({ sub } only) remain valid.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);

    if (decoded.identityType === PLATFORM_IDENTITY_TYPE) {
      return next(new ApiError(401, "Tenant staff authentication required"));
    }

    const user = await User.findById(decoded.sub)
      .select("-password")
      .populate("teamId", "name")
      .populate("applicationIds", "name code");

    if (!user || !isUserLoginAllowed(user)) {
      return next(new ApiError(401, "Invalid or inactive account"));
    }

    req.user = user;
    next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};

module.exports = authenticate;
