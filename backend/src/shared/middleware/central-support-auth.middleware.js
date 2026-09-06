const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const env = require("../../config/env");
const CentralSupportUser = require("../../modules/central-support/central-support-user.model");
const {
  CENTRAL_SUPPORT_IDENTITY_TYPE,
  CENTRAL_SUPPORT_ERROR_CODES
} = require("../constants/central-support");
const { isAuthenticatableStatus } = require("../../modules/central-support/central-support-auth.service");

/**
 * Authenticate Central Support JWT only.
 * Rejects Platform Admin and tenant staff tokens.
 */
const authenticateCentralSupport = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);

    if (decoded.identityType !== CENTRAL_SUPPORT_IDENTITY_TYPE) {
      return next(
        new ApiError(401, "Central Support authentication required", {
          code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_ACCESS_DENIED
        })
      );
    }

    const user = await CentralSupportUser.findById(decoded.sub).select("-password");

    if (!user || !isAuthenticatableStatus(user.status)) {
      return next(
        new ApiError(401, "Invalid or inactive central support account", {
          code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_USER_INACTIVE
        })
      );
    }

    req.centralSupportUser = user;
    next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};

const requireCentralSupportRole = (...allowedRoles) => (req, res, next) => {
  if (!req.centralSupportUser) {
    return next(
      new ApiError(401, "Central Support authentication required", {
        code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_ACCESS_DENIED
      })
    );
  }

  if (!allowedRoles.includes(req.centralSupportUser.role)) {
    return next(
      new ApiError(403, "Insufficient Central Support permissions", {
        code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_ACCESS_DENIED
      })
    );
  }

  next();
};

module.exports = {
  authenticateCentralSupport,
  requireCentralSupportRole
};
