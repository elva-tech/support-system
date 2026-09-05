const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const PlatformAdmin = require("./platform-admin.model");
const {
  PLATFORM_IDENTITY_TYPE,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../../shared/constants/platform");
const {
  invalidPlatformCredentials,
  platformAdminInactive,
  platformAdminNotFound
} = require("./platform-admin.errors");
const {
  normalizeEmail,
  isAuthenticatableStatus,
  toPublicPlatformAdmin
} = require("./platform-admin.validation");
const { logPlatformAudit } = require("./platform-audit.service");

const signPlatformToken = (admin) =>
  jwt.sign(
    {
      sub: String(admin._id),
      identityType: PLATFORM_IDENTITY_TYPE,
      role: admin.role
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

/**
 * Platform login — generic errors for unknown email / bad password.
 * Never returns passwordHash. Updates lastLoginAt on success.
 */
const login = async (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  const admin = await PlatformAdmin.findOne({ email: normalizedEmail }).select("+password");

  if (!admin) {
    throw invalidPlatformCredentials();
  }

  if (!isAuthenticatableStatus(admin.status)) {
    throw platformAdminInactive();
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw invalidPlatformCredentials();
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  const token = signPlatformToken(admin);

  await logPlatformAudit({
    actorPlatformAdminId: admin._id,
    actorEmail: admin.email,
    action: PLATFORM_AUDIT_ACTIONS.PLATFORM_ADMIN_LOGIN,
    targetType: PLATFORM_AUDIT_TARGET_TYPES.PLATFORM_ADMIN,
    targetId: admin._id,
    metadata: { role: admin.role }
  });

  return {
    token,
    admin: toPublicPlatformAdmin(admin)
  };
};

const getMe = async (adminId) => {
  const admin = await PlatformAdmin.findById(adminId);
  if (!admin) {
    throw platformAdminNotFound();
  }
  if (!isAuthenticatableStatus(admin.status)) {
    throw platformAdminInactive();
  }
  return toPublicPlatformAdmin(admin);
};

module.exports = {
  signPlatformToken,
  login,
  getMe
};
