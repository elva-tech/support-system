const ApiError = require("../../shared/utils/ApiError");
const { PLATFORM_ERROR_CODES } = require("../../shared/constants/platform");

const platformError = (statusCode, code, message) =>
  new ApiError(statusCode, message, { code });

const platformAdminNotFound = () =>
  platformError(404, PLATFORM_ERROR_CODES.PLATFORM_ADMIN_NOT_FOUND, "Platform admin not found");

const platformAdminEmailExists = () =>
  platformError(
    409,
    PLATFORM_ERROR_CODES.PLATFORM_ADMIN_EMAIL_ALREADY_EXISTS,
    "Platform admin email already exists"
  );

const platformAdminInactive = () =>
  platformError(403, PLATFORM_ERROR_CODES.PLATFORM_ADMIN_INACTIVE, "Platform admin account is inactive");

const invalidPlatformRole = (role) =>
  platformError(
    400,
    PLATFORM_ERROR_CODES.INVALID_PLATFORM_ROLE,
    `Invalid platform role: ${role}`
  );

const platformAccessDenied = () =>
  platformError(403, PLATFORM_ERROR_CODES.PLATFORM_ACCESS_DENIED, "Platform access denied");

const invalidTenantStatusTransition = (from, to) =>
  platformError(
    400,
    PLATFORM_ERROR_CODES.INVALID_TENANT_STATUS_TRANSITION,
    `Cannot transition tenant status from ${from} to ${to}`
  );

const lastSuperAdminProtected = () =>
  platformError(
    400,
    PLATFORM_ERROR_CODES.LAST_SUPER_ADMIN_PROTECTED,
    "Cannot disable or demote the last active platform super admin"
  );

const invalidPlatformCredentials = () =>
  platformError(401, PLATFORM_ERROR_CODES.INVALID_PLATFORM_CREDENTIALS, "Invalid email or password");

module.exports = {
  platformError,
  platformAdminNotFound,
  platformAdminEmailExists,
  platformAdminInactive,
  invalidPlatformRole,
  platformAccessDenied,
  invalidTenantStatusTransition,
  lastSuperAdminProtected,
  invalidPlatformCredentials
};
