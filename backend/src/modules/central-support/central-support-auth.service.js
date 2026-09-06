const jwt = require("jsonwebtoken");
const ApiError = require("../../shared/utils/ApiError");
const env = require("../../config/env");
const CentralSupportUser = require("./central-support-user.model");
const {
  CENTRAL_SUPPORT_IDENTITY_TYPE,
  CENTRAL_SUPPORT_USER_STATUSES,
  CENTRAL_SUPPORT_ROLES,
  CENTRAL_SUPPORT_ERROR_CODES
} = require("../../shared/constants/central-support");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isAuthenticatableStatus = (status) => status === CENTRAL_SUPPORT_USER_STATUSES.ACTIVE;

const toPublicUser = (user) => {
  if (!user) return null;
  const o = user.toObject ? user.toObject() : { ...user };
  return {
    id: String(o._id),
    name: o.name,
    email: o.email,
    role: o.role,
    status: o.status,
    teamId: o.teamId ? String(o.teamId) : null,
    lastLoginAt: o.lastLoginAt || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
};

const signToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      identityType: CENTRAL_SUPPORT_IDENTITY_TYPE,
      role: user.role
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

const login = async (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await CentralSupportUser.findOne({ email: normalizedEmail }).select("+password");

  if (!user || !isAuthenticatableStatus(user.status)) {
    throw new ApiError(401, "Invalid email or password", {
      code: CENTRAL_SUPPORT_ERROR_CODES.INVALID_CENTRAL_SUPPORT_CREDENTIALS
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid email or password", {
      code: CENTRAL_SUPPORT_ERROR_CODES.INVALID_CENTRAL_SUPPORT_CREDENTIALS
    });
  }

  user.lastLoginAt = new Date();
  await user.save();

  return {
    token: signToken(user),
    user: toPublicUser(user)
  };
};

const getMe = async (userId) => {
  const user = await CentralSupportUser.findById(userId);
  if (!user || !isAuthenticatableStatus(user.status)) {
    throw new ApiError(401, "Invalid or inactive central support account", {
      code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_USER_INACTIVE
    });
  }
  return toPublicUser(user);
};

/**
 * Idempotent bootstrap of the first CENTRAL_SUPPORT_ADMIN from env credentials.
 */
const ensureBootstrapAdmin = async ({ name, email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new ApiError(400, "Bootstrap email and password are required");
  }

  const existing = await CentralSupportUser.findOne({ email: normalizedEmail });
  if (existing) {
    return { user: toPublicUser(existing), created: false };
  }

  const user = await CentralSupportUser.create({
    name: String(name || "Central Support Admin").trim(),
    email: normalizedEmail,
    password: String(password),
    role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN,
    status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE,
    createdBy: null
  });

  return { user: toPublicUser(user), created: true };
};

module.exports = {
  login,
  getMe,
  signToken,
  toPublicUser,
  normalizeEmail,
  isAuthenticatableStatus,
  ensureBootstrapAdmin
};
