const ApiError = require("../../shared/utils/ApiError");
const User = require("./user.model");
const Team = require("../teams/team.model");
const Application = require("../applications/application.model");
const { ROLES } = require("../../shared/constants/roles");
const onboardingEmail = require("../notifications/onboarding-email.service");

const populateOptions = [
  { path: "teamId", select: "name" },
  { path: "applicationIds", select: "name code" }
];

const validateReferences = async ({ teamId, applicationIds }) => {
  if (teamId) {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new ApiError(400, "Team not found");
    }
  }

  if (applicationIds?.length) {
    const applications = await Application.find({ _id: { $in: applicationIds } });
    if (applications.length !== applicationIds.length) {
      throw new ApiError(400, "One or more applications not found");
    }
  }
};

const deriveApplicationIdsFromTeam = async (teamId) => {
  const team = await Team.findById(teamId).select("applicationId");
  if (!team) {
    throw new ApiError(400, "Team not found");
  }
  return [team.applicationId];
};

const applyStaffTeamAssignment = async (data) => {
  if (data.role === ROLES.ADMIN) {
    data.teamId = null;
    data.applicationIds = [];
    return;
  }

  if (!data.teamId) {
    throw new ApiError(400, "Please select an application and team");
  }

  data.applicationIds = await deriveApplicationIdsFromTeam(data.teamId);
};

const syncTeamMembership = async (userId, teamId, previousTeamId = null, role = null) => {
  if (role === ROLES.ADMIN) {
    if (previousTeamId) {
      await Team.findByIdAndUpdate(previousTeamId, { $pull: { memberIds: userId } });
    }
    return;
  }

  if (previousTeamId && previousTeamId.toString() !== teamId?.toString()) {
    await Team.findByIdAndUpdate(previousTeamId, { $pull: { memberIds: userId } });
  }

  if (teamId) {
    await Team.findByIdAndUpdate(teamId, { $addToSet: { memberIds: userId } });
  }
};

/** When a TEAM_LEAD is assigned to a team, promote them to team lead automatically. */
const syncTeamLeadRole = async (user, { previousTeamId = null, previousRole = null } = {}) => {
  if (user.role === ROLES.ADMIN) {
    return;
  }

  const userId = user._id;
  const teamId = user.teamId?.toString();
  const prevTeamId = previousTeamId?.toString();

  if (prevTeamId && prevTeamId !== teamId) {
    await Team.findOneAndUpdate({ _id: prevTeamId, teamLeadId: userId }, { $set: { teamLeadId: null } });
  }

  if (previousRole === ROLES.TEAM_LEAD && user.role !== ROLES.TEAM_LEAD && teamId) {
    await Team.findOneAndUpdate({ _id: teamId, teamLeadId: userId }, { $set: { teamLeadId: null } });
  }

  if (user.role === ROLES.TEAM_LEAD && teamId) {
    await Team.findByIdAndUpdate(teamId, {
      $set: { teamLeadId: userId },
      $addToSet: { memberIds: userId }
    });
  }
};

const list = async (filters = {}) => {
  const query = {};

  if (filters.role) {
    query.role = filters.role;
  }

  if (filters.teamId) {
    query.teamId = filters.teamId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  if (filters.search) {
    query.$or = [
      { firstName: { $regex: filters.search, $options: "i" } },
      { lastName: { $regex: filters.search, $options: "i" } },
      { email: { $regex: filters.search, $options: "i" } }
    ];
  }

  return User.find(query).populate(populateOptions).sort({ lastName: 1, firstName: 1 });
};

const getById = async (id) => {
  const user = await User.findById(id).populate(populateOptions);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

const create = async (data) => {
  const existing = await User.findOne({ email: data.email });

  if (existing) {
    throw new ApiError(409, "Email already exists");
  }

  const plainPassword = data.password;
  await applyStaffTeamAssignment(data);
  await validateReferences(data);

  const user = await User.create(data);
  await syncTeamMembership(user._id, user.teamId, null, user.role);
  await syncTeamLeadRole(user);

  if (user.role !== ROLES.ADMIN && plainPassword) {
    await onboardingEmail.sendStaffWelcomeEmail(user, plainPassword);
  }

  return User.findById(user._id).populate(populateOptions);
};

const update = async (id, data) => {
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (data.email && data.email !== user.email) {
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      throw new ApiError(409, "Email already exists");
    }
  }

  await validateReferences({ ...user.toObject(), ...data });

  const previousTeamId = user.teamId;
  const previousRole = user.role;
  const plainPassword = data.password || null;

  if (data.password) {
    user.password = data.password;
    delete data.password;
  }

  Object.assign(user, data);

  const nextRole = data.role ?? user.role;
  const nextTeamId = nextRole === ROLES.ADMIN ? null : data.teamId ?? user.teamId;

  if (nextRole === ROLES.ADMIN) {
    user.teamId = null;
    user.applicationIds = [];
  } else if (nextTeamId) {
    user.teamId = nextTeamId;
    user.applicationIds = await deriveApplicationIdsFromTeam(nextTeamId);
  } else if (!user.teamId) {
    throw new ApiError(400, "Please select an application and team");
  }

  await user.save();

  await syncTeamMembership(user._id, user.teamId, previousTeamId, user.role);
  await syncTeamLeadRole(user, { previousTeamId, previousRole });

  if (plainPassword && user.role !== ROLES.ADMIN) {
    await onboardingEmail.sendStaffPasswordUpdatedEmail(user, plainPassword);
  }

  return User.findById(id).populate(populateOptions);
};

const remove = async (id, currentUserId) => {
  if (id === currentUserId.toString()) {
    throw new ApiError(400, "Cannot delete your own account");
  }

  const user = await getById(id);
  await user.deleteOne();
  return user;
};

module.exports = { list, getById, create, update, remove };
