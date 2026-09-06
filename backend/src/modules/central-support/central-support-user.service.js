const ApiError = require("../../shared/utils/ApiError");
const CentralSupportUser = require("./central-support-user.model");
const CentralSupportTeam = require("./central-support-team.model");
const { toPublicUser, normalizeEmail } = require("./central-support-auth.service");
const {
  CENTRAL_SUPPORT_ROLES,
  ALL_CENTRAL_SUPPORT_ROLES,
  CENTRAL_SUPPORT_USER_STATUSES,
  ALL_CENTRAL_SUPPORT_USER_STATUSES,
  CENTRAL_SUPPORT_ERROR_CODES,
  CENTRAL_SUPPORT_ASSIGNABLE_ROLES
} = require("../../shared/constants/central-support");

const assertValidRole = (role) => {
  if (!ALL_CENTRAL_SUPPORT_ROLES.includes(role)) {
    throw new ApiError(400, "Invalid Central Support role", {
      code: CENTRAL_SUPPORT_ERROR_CODES.INVALID_CENTRAL_SUPPORT_ROLE
    });
  }
};

const syncTeamMembership = async (userId, nextTeamId, prevTeamId) => {
  if (prevTeamId && String(prevTeamId) !== String(nextTeamId || "")) {
    const prev = await CentralSupportTeam.findById(prevTeamId);
    if (prev) {
      prev.memberIds = (prev.memberIds || []).filter((id) => String(id) !== String(userId));
      if (prev.teamLeadId && String(prev.teamLeadId) === String(userId)) {
        prev.teamLeadId = null;
      }
      await prev.save();
    }
  }

  if (nextTeamId) {
    await CentralSupportTeam.updateOne(
      { _id: nextTeamId },
      { $addToSet: { memberIds: userId } }
    );
  }
};

const syncTeamLead = async (user) => {
  if (!user.teamId) return;
  const team = await CentralSupportTeam.findById(user.teamId);
  if (!team) return;

  if (user.role === CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD) {
    team.teamLeadId = user._id;
    if (!team.memberIds.some((id) => String(id) === String(user._id))) {
      team.memberIds.push(user._id);
    }
    await team.save();
  } else if (team.teamLeadId && String(team.teamLeadId) === String(user._id)) {
    team.teamLeadId = null;
    await team.save();
  }
};

const listUsers = async ({ status, role, teamId } = {}) => {
  const query = {};
  if (status && ALL_CENTRAL_SUPPORT_USER_STATUSES.includes(status)) query.status = status;
  if (role && ALL_CENTRAL_SUPPORT_ROLES.includes(role)) query.role = role;
  if (teamId) query.teamId = teamId;

  const users = await CentralSupportUser.find(query).sort({ name: 1 });
  return users.map(toPublicUser);
};

const listAssignees = async () => {
  const users = await CentralSupportUser.find({
    status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE,
    role: { $in: CENTRAL_SUPPORT_ASSIGNABLE_ROLES }
  })
    .select("name email role teamId")
    .sort({ name: 1 });

  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    teamId: u.teamId ? String(u.teamId) : null
  }));
};

const createUser = async ({ name, email, password, role, teamId, actor }) => {
  const normalizedEmail = normalizeEmail(email);
  assertValidRole(role);

  if (role === CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN && !password) {
    throw new ApiError(400, "Password is required for admins");
  }

  const existing = await CentralSupportUser.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, "Email already exists", {
      code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_EMAIL_EXISTS
    });
  }

  if (teamId) {
    const team = await CentralSupportTeam.findById(teamId);
    if (!team || !team.isActive) {
      throw new ApiError(400, "Team not found or inactive", {
        code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_TEAM_NOT_FOUND
      });
    }
  }

  if (
    role !== CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN &&
    !teamId &&
    role !== CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN
  ) {
    // Agents/leads should have a team when assigned — allow null initially
  }

  const plainPassword = String(password || "").trim();
  if (plainPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const user = await CentralSupportUser.create({
    name: String(name || "").trim(),
    email: normalizedEmail,
    password: plainPassword,
    role,
    status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE,
    teamId: teamId || null,
    createdBy: actor?._id || null
  });

  await syncTeamMembership(user._id, user.teamId, null);
  await syncTeamLead(user);

  return toPublicUser(user);
};

const updateUser = async ({ userId, patch, actor }) => {
  const user = await CentralSupportUser.findById(userId);
  if (!user) {
    throw new ApiError(404, "Central Support user not found", {
      code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_USER_NOT_FOUND
    });
  }

  const prevTeamId = user.teamId;

  if (patch.name !== undefined) user.name = String(patch.name).trim();
  if (patch.email !== undefined) {
    const normalizedEmail = normalizeEmail(patch.email);
    const clash = await CentralSupportUser.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id }
    });
    if (clash) {
      throw new ApiError(409, "Email already exists", {
        code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_EMAIL_EXISTS
      });
    }
    user.email = normalizedEmail;
  }
  if (patch.role !== undefined) {
    assertValidRole(patch.role);
    user.role = patch.role;
  }
  if (patch.status !== undefined) {
    if (!ALL_CENTRAL_SUPPORT_USER_STATUSES.includes(patch.status)) {
      throw new ApiError(400, "Invalid status");
    }
    user.status = patch.status;
  }
  if (patch.teamId !== undefined) {
    if (patch.teamId === null || patch.teamId === "") {
      user.teamId = null;
    } else {
      const team = await CentralSupportTeam.findById(patch.teamId);
      if (!team) {
        throw new ApiError(400, "Team not found", {
          code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_TEAM_NOT_FOUND
        });
      }
      user.teamId = team._id;
    }
  }
  if (patch.password) {
    const plain = String(patch.password).trim();
    if (plain.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
    user.password = plain;
  }

  await user.save();
  await syncTeamMembership(user._id, user.teamId, prevTeamId);
  await syncTeamLead(user);

  return toPublicUser(user);
};

const getUser = async (userId) => {
  const user = await CentralSupportUser.findById(userId);
  if (!user) {
    throw new ApiError(404, "Central Support user not found", {
      code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_USER_NOT_FOUND
    });
  }
  return toPublicUser(user);
};

module.exports = {
  listUsers,
  listAssignees,
  createUser,
  updateUser,
  getUser,
  toPublicUser
};
