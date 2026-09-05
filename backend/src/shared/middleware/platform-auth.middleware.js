const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const env = require("../../config/env");
const PlatformAdmin = require("../../modules/platform-admin/platform-admin.model");
const {
  PLATFORM_IDENTITY_TYPE,
  PLATFORM_ERROR_CODES
} = require("../constants/platform");
const { isAuthenticatableStatus } = require("../../modules/platform-admin/platform-admin.validation");

/**
 * Authenticate Platform Admin JWT only.
 * Rejects tenant staff JWTs (missing or wrong identityType).
 */
const authenticatePlatformAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);

    if (decoded.identityType !== PLATFORM_IDENTITY_TYPE) {
      return next(
        new ApiError(401, "Platform authentication required", {
          code: PLATFORM_ERROR_CODES.PLATFORM_ACCESS_DENIED
        })
      );
    }

    const admin = await PlatformAdmin.findById(decoded.sub).select("-password");

    if (!admin || !isAuthenticatableStatus(admin.status)) {
      return next(
        new ApiError(401, "Invalid or inactive platform account", {
          code: PLATFORM_ERROR_CODES.PLATFORM_ADMIN_INACTIVE
        })
      );
    }

    req.platformAdmin = admin;
    next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};

/**
 * Require one of the listed platform roles.
 * Does not imply hierarchy — callers must list every allowed role explicitly.
 */
const requirePlatformRole = (...allowedRoles) => (req, res, next) => {
  if (!req.platformAdmin) {
    return next(
      new ApiError(401, "Platform authentication required", {
        code: PLATFORM_ERROR_CODES.PLATFORM_ACCESS_DENIED
      })
    );
  }

  if (!allowedRoles.includes(req.platformAdmin.role)) {
    return next(
      new ApiError(403, "Insufficient platform permissions", {
        code: PLATFORM_ERROR_CODES.PLATFORM_ACCESS_DENIED
      })
    );
  }

  next();
};

module.exports = {
  authenticatePlatformAdmin,
  requirePlatformRole
};
