const {
  ALL_PLATFORM_ROLES,
  ALL_PLATFORM_ADMIN_STATUSES,
  PLATFORM_ADMIN_STATUSES,
  PLATFORM_ROLES
} = require("../../shared/constants/platform");
const { invalidPlatformRole } = require("./platform-admin.errors");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const assertValidPlatformRole = (role) => {
  if (!ALL_PLATFORM_ROLES.includes(role)) {
    throw invalidPlatformRole(role);
  }
  return role;
};

const assertValidPlatformAdminStatus = (status) => {
  if (!ALL_PLATFORM_ADMIN_STATUSES.includes(status)) {
    const ApiError = require("../../shared/utils/ApiError");
    const { PLATFORM_ERROR_CODES } = require("../../shared/constants/platform");
    throw new ApiError(400, `Invalid platform admin status: ${status}`, {
      code: PLATFORM_ERROR_CODES.PLATFORM_ADMIN_INACTIVE
    });
  }
  return status;
};

const assertValidPlatformAdminName = (name) => {
  const trimmed = String(name || "").trim();
  if (!trimmed || trimmed.length > 200) {
    const ApiError = require("../../shared/utils/ApiError");
    throw new ApiError(400, "Platform admin name is required (max 200 characters)");
  }
  return trimmed;
};

const assertValidPlatformAdminEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_RE.test(normalized)) {
    const ApiError = require("../../shared/utils/ApiError");
    throw new ApiError(400, "Valid platform admin email is required");
  }
  return normalized;
};

const assertValidPlatformPassword = (password) => {
  if (!password || String(password).length < 8) {
    const ApiError = require("../../shared/utils/ApiError");
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  return String(password);
};

/** Whether the actor may assign/create the given target role. */
const canAssignPlatformRole = (actorRole, targetRole) => {
  if (actorRole === PLATFORM_ROLES.PLATFORM_SUPER_ADMIN) {
    return ALL_PLATFORM_ROLES.includes(targetRole);
  }
  if (actorRole === PLATFORM_ROLES.PLATFORM_ADMIN) {
    return (
      targetRole === PLATFORM_ROLES.PLATFORM_ADMIN ||
      targetRole === PLATFORM_ROLES.PLATFORM_SUPPORT
    );
  }
  return false;
};

const isAuthenticatableStatus = (status) => status === PLATFORM_ADMIN_STATUSES.ACTIVE;

const toPublicPlatformAdmin = (admin) => {
  if (!admin) {
    return null;
  }
  const obj = typeof admin.toObject === "function" ? admin.toObject() : { ...admin };
  delete obj.password;
  return {
    id: String(obj._id),
    name: obj.name,
    email: obj.email,
    role: obj.role,
    status: obj.status,
    lastLoginAt: obj.lastLoginAt || null,
    createdBy: obj.createdBy ? String(obj.createdBy) : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

module.exports = {
  normalizeEmail,
  assertValidPlatformRole,
  assertValidPlatformAdminStatus,
  assertValidPlatformAdminName,
  assertValidPlatformAdminEmail,
  assertValidPlatformPassword,
  canAssignPlatformRole,
  isAuthenticatableStatus,
  toPublicPlatformAdmin
};
