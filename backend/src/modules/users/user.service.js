const ApiError = require("../../shared/utils/ApiError");
const User = require("./user.model");
const Team = require("../teams/team.model");
const Application = require("../applications/application.model");
const { ROLES } = require("../../shared/constants/roles");
const { USER_STATUSES } = require("../../shared/constants/user-lifecycle");
const { stripClientTenantId, withTenantFilter } = require("../../shared/utils/tenant-scope.util");
const staffInvitationService = require("../staff-invitations/staff-invitation.service");

const populateOptions = [
  { path: "teamId", select: "name" },
  { path: "applicationIds", select: "name code" }
];

const validateReferences = async ({ teamId, applicationIds }, { tenantId } = {}) => {
  if (teamId) {
    const team = await Team.findOne(withTenantFilter(tenantId, { _id: teamId }));
    if (!team) {
      throw new ApiError(400, "Team not found");
    }
  }

  if (applicationIds?.length) {
    const applications = await Application.find(
      withTenantFilter(tenantId, { _id: { $in: applicationIds } })
    );
    if (applications.length !== applicationIds.length) {
      throw new ApiError(400, "One or more applications not found");
    }
  }
};

const deriveApplicationIdsFromTeam = async (teamId, { tenantId } = {}) => {
  const team = await Team.findOne(withTenantFilter(tenantId, { _id: teamId })).select("applicationId");
  if (!team) {
    throw new ApiError(400, "Team not found");
  }
  return [team.applicationId];
};

const applyStaffTeamAssignment = async (data, { tenantId } = {}) => {
  if (data.role === ROLES.ADMIN) {
    data.teamId = null;
    data.applicationIds = [];
    return;
  }

  if (!data.teamId) {
    throw new ApiError(400, "Please select an application and team");
  }

  data.applicationIds = await deriveApplicationIdsFromTeam(data.teamId, { tenantId });
};

const syncTeamMembership = async (userId, teamId, previousTeamId = null, role = null, { tenantId } = {}) => {
  if (role === ROLES.ADMIN) {
    if (previousTeamId) {
      await Team.findOneAndUpdate(
        withTenantFilter(tenantId, { _id: previousTeamId }),
        { $pull: { memberIds: userId } }
      );
    }
    return;
  }

  if (previousTeamId && previousTeamId.toString() !== teamId?.toString()) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: previousTeamId }),
      { $pull: { memberIds: userId } }
    );
  }

  if (teamId) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: teamId }),
      { $addToSet: { memberIds: userId } }
    );
  }
};

/** When a TEAM_LEAD is assigned to a team, promote them to team lead automatically. */
const syncTeamLeadRole = async (user, { previousTeamId = null, previousRole = null, tenantId } = {}) => {
  if (user.role === ROLES.ADMIN) {
    return;
  }

  const userId = user._id;
  const teamId = user.teamId?.toString();
  const prevTeamId = previousTeamId?.toString();

  if (prevTeamId && prevTeamId !== teamId) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: prevTeamId, teamLeadId: userId }),
      { $set: { teamLeadId: null } }
    );
  }

  if (previousRole === ROLES.TEAM_LEAD && user.role !== ROLES.TEAM_LEAD && teamId) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: teamId, teamLeadId: userId }),
      { $set: { teamLeadId: null } }
    );
  }

  if (user.role === ROLES.TEAM_LEAD && teamId) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: teamId }),
      {
        $set: { teamLeadId: userId },
        $addToSet: { memberIds: userId }
      }
    );
  }
};

const list = async (filters = {}, { tenantId } = {}) => {
  const query = withTenantFilter(tenantId);

  if (filters.role) {
    query.role = filters.role;
  }

  if (filters.teamId) {
    query.teamId = filters.teamId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  if (filters.status) {
    query.status = filters.status;
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

const getById = async (id, { tenantId } = {}) => {
  const user = await User.findOne(withTenantFilter(tenantId, { _id: id })).populate(populateOptions);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

/**
 * Create/invite staff — Phase 10: no admin-supplied passwords.
 * Delegates to staff invitation flow (INVITED + secure setup link).
 */
const create = async (data, { tenantId, createdByUserId } = {}) => {
  return staffInvitationService.inviteStaff(data, { tenantId, createdByUserId });
};

const update = async (id, data, { tenantId } = {}) => {
  const user = await User.findOne(withTenantFilter(tenantId, { _id: id }));

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const payload = stripClientTenantId(data);

  if (payload.email && payload.email !== user.email) {
    const existing = await User.findOne({ email: payload.email, tenantId });
    if (existing) {
      throw new ApiError(409, "Email already exists");
    }
  }

  await validateReferences({ ...user.toObject(), ...payload }, { tenantId });

  const previousTeamId = user.teamId;
  const previousRole = user.role;

  // Admins must not set or learn passwords — staff use invitation setup
  delete payload.password;

  if (payload.status) {
    if (payload.status === USER_STATUSES.ACTIVE && user.status === USER_STATUSES.INVITED) {
      throw new ApiError(400, "Invited users must complete account setup to become active");
    }
  } else if (payload.isActive !== undefined) {
    if (payload.isActive === true && user.status === USER_STATUSES.INVITED) {
      throw new ApiError(400, "Invited users must complete account setup to become active");
    }
    if (payload.isActive === true) {
      payload.status = USER_STATUSES.ACTIVE;
    } else if (user.status === USER_STATUSES.ACTIVE || !user.status) {
      payload.status = USER_STATUSES.DEACTIVATED;
    }
  }

  Object.assign(user, payload);

  const nextRole = payload.role ?? user.role;
  const nextTeamId = nextRole === ROLES.ADMIN ? null : payload.teamId ?? user.teamId;

  if (nextRole === ROLES.ADMIN) {
    user.teamId = null;
    user.applicationIds = [];
  } else if (nextTeamId) {
    user.teamId = nextTeamId;
    user.applicationIds = await deriveApplicationIdsFromTeam(nextTeamId, { tenantId });
  } else if (!user.teamId) {
    throw new ApiError(400, "Please select an application and team");
  }

  await user.save();

  await syncTeamMembership(user._id, user.teamId, previousTeamId, user.role, { tenantId });
  await syncTeamLeadRole(user, { previousTeamId, previousRole, tenantId });

  return User.findOne(withTenantFilter(tenantId, { _id: id })).populate(populateOptions);
};

const remove = async (id, currentUserId, { tenantId } = {}) => {
  if (id === currentUserId.toString()) {
    throw new ApiError(400, "Cannot delete your own account");
  }

  const user = await getById(id, { tenantId });
  await user.deleteOne();
  return user;
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  inviteStaff: staffInvitationService.inviteStaff,
  resendInvitation: staffInvitationService.resendInvitation,
  revokeInvitation: staffInvitationService.revokeInvitation,
  suspendUser: staffInvitationService.suspendUser,
  deactivateUser: staffInvitationService.deactivateUser,
  reactivateUser: staffInvitationService.reactivateUser
};
