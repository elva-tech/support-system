const jwt = require("jsonwebtoken");
const ApiError = require("../../shared/utils/ApiError");
const env = require("../../config/env");
const User = require("../users/user.model");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");

const signToken = (userId) =>
  jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const login = async (email, password) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user || !user.isActive) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = signToken(user._id);
  const profile = await User.findById(user._id)
    .populate("teamId", "name")
    .populate("applicationIds", "name code");

  await logAudit({
    entityType: ENTITY_TYPES.USER,
    entityId: user._id,
    action: AUDIT_ACTIONS.AGENT_LOGIN,
    actorType: ACTOR_TYPES.AGENT,
    actorId: user._id,
    actorName: `${user.firstName} ${user.lastName}`,
    metadata: { email: user.email, role: user.role }
  });

  return { token, user: profile };
};

const getProfile = async (userId) => {
  const user = await User.findById(userId)
    .populate("teamId", "name")
    .populate("applicationIds", "name code");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

module.exports = { login, getProfile };
