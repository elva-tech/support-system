const ApiError = require("../../shared/utils/ApiError");
const Team = require("./team.model");
const Application = require("../applications/application.model");
const Module = require("../modules/module.model");
const User = require("../users/user.model");
const { ROLES } = require("../../shared/constants/roles");
const { stripClientTenantId, withTenantFilter } = require("../../shared/utils/tenant-scope.util");

const populateOptions = [
  { path: "applicationId", select: "name code" },
  { path: "moduleIds", select: "name code" },
  { path: "teamLeadId", select: "firstName lastName email role" },
  { path: "memberIds", select: "firstName lastName email role" }
];

const normalizeId = (id) => {
  if (!id) return null;
  if (typeof id === "object" && id._id) return id._id.toString();
  return id.toString();
};

const normalizeIds = (ids = []) => ids.map(normalizeId).filter(Boolean);

const excludeAdminsFromTeamUsers = async ({ teamLeadId, memberIds = [] }, { tenantId } = {}) => {
  const candidateIds = [
    ...normalizeIds(memberIds),
    ...(teamLeadId ? [normalizeId(teamLeadId)] : [])
  ];
  const uniqueIds = [...new Set(candidateIds)];

  if (!uniqueIds.length) {
    return { teamLeadId: null, memberIds: [] };
  }

  const staffUsers = await User.find(
    withTenantFilter(tenantId, {
      _id: { $in: uniqueIds },
      role: { $ne: ROLES.ADMIN }
    })
  ).select("_id");

  const staffSet = new Set(staffUsers.map((u) => u._id.toString()));
  const leadId = teamLeadId ? normalizeId(teamLeadId) : null;
  const staffMemberIds = normalizeIds(memberIds).filter((id) => staffSet.has(id));

  return {
    teamLeadId: leadId && staffSet.has(leadId) ? leadId : null,
    memberIds: staffMemberIds
  };
};

const withStaffOnly = (team) => {
  if (team.memberIds?.length) {
    team.memberIds = team.memberIds.filter(
      (member) => (typeof member === "object" ? member.role : null) !== ROLES.ADMIN
    );
  }

  if (
    team.teamLeadId &&
    typeof team.teamLeadId === "object" &&
    team.teamLeadId.role === ROLES.ADMIN
  ) {
    team.teamLeadId = null;
  }

  return team;
};

const validateReferences = async (
  { applicationId, moduleIds, teamLeadId, memberIds },
  { tenantId } = {}
) => {
  if (applicationId) {
    const application = await Application.findOne(
      withTenantFilter(tenantId, { _id: applicationId })
    );
    if (!application) {
      throw new ApiError(400, "Application not found");
    }
  }

  if (moduleIds?.length) {
    // Module has no tenantId yet — scope via parent application within tenant
    const modules = await Module.find({ _id: { $in: moduleIds } });
    if (modules.length !== moduleIds.length) {
      throw new ApiError(400, "One or more modules not found");
    }
    const applicationIds = [...new Set(modules.map((m) => m.applicationId.toString()))];
    const applications = await Application.find(
      withTenantFilter(tenantId, { _id: { $in: applicationIds } })
    );
    if (applications.length !== applicationIds.length) {
      throw new ApiError(400, "One or more modules not found");
    }
  }

  const userIds = [...(memberIds || [])];
  if (teamLeadId) {
    userIds.push(teamLeadId);
  }

  if (userIds.length) {
    const users = await User.find(withTenantFilter(tenantId, { _id: { $in: userIds } }));
    if (users.length !== userIds.length) {
      throw new ApiError(400, "One or more users not found");
    }
  }
};

const list = async (filters = {}, { tenantId } = {}) => {
  const query = withTenantFilter(tenantId);

  if (filters.applicationId) {
    query.applicationId = filters.applicationId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  if (filters.search) {
    query.name = { $regex: filters.search, $options: "i" };
  }

  return Team.find(query).populate(populateOptions).sort({ name: 1 }).then((teams) => teams.map(withStaffOnly));
};

const getById = async (id, { tenantId } = {}) => {
  const team = await Team.findOne(withTenantFilter(tenantId, { _id: id })).populate(populateOptions);

  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  return withStaffOnly(team);
};

const buildTeamMemberIds = (teamLeadId, memberIds) => {
  const ids = [...normalizeIds(memberIds)];
  if (teamLeadId && !ids.includes(teamLeadId)) {
    ids.push(teamLeadId);
  }
  return ids;
};

const create = async (data, { tenantId } = {}) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }

  const payload = stripClientTenantId(data);
  await validateReferences(payload, { tenantId });

  const sanitized = await excludeAdminsFromTeamUsers(
    {
      teamLeadId: payload.teamLeadId,
      memberIds: payload.memberIds
    },
    { tenantId }
  );
  const memberIds = buildTeamMemberIds(sanitized.teamLeadId, sanitized.memberIds);

  const team = await Team.create({
    ...payload,
    tenantId,
    moduleIds: [],
    teamLeadId: sanitized.teamLeadId,
    memberIds
  });
  await syncUsersTeamAssignment(team._id, memberIds, sanitized.teamLeadId, { tenantId });

  return withStaffOnly(
    await Team.findOne(withTenantFilter(tenantId, { _id: team._id })).populate(populateOptions)
  );
};

const update = async (id, data, { tenantId } = {}) => {
  const team = await Team.findOne(withTenantFilter(tenantId, { _id: id })).populate(populateOptions);

  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  const payload = stripClientTenantId(data);
  await validateReferences({ ...team.toObject(), ...payload }, { tenantId });

  const sanitized = await excludeAdminsFromTeamUsers(
    {
      teamLeadId: payload.teamLeadId !== undefined ? payload.teamLeadId : team.teamLeadId,
      memberIds: payload.memberIds !== undefined ? payload.memberIds : team.memberIds
    },
    { tenantId }
  );
  const memberIds = buildTeamMemberIds(sanitized.teamLeadId, sanitized.memberIds);

  Object.assign(team, payload, {
    teamLeadId: sanitized.teamLeadId,
    memberIds
  });
  await team.save();

  await syncUsersTeamAssignment(team._id, memberIds, sanitized.teamLeadId, { tenantId });

  return withStaffOnly(
    await Team.findOne(withTenantFilter(tenantId, { _id: id })).populate(populateOptions)
  );
};

const remove = async (id, { tenantId } = {}) => {
  const team = await getById(id, { tenantId });
  await team.deleteOne();
  return team;
};

const syncUsersTeamAssignment = async (teamId, memberIds = [], teamLeadId = null, { tenantId } = {}) => {
  const userIds = [...new Set([...normalizeIds(memberIds), ...(teamLeadId ? [normalizeId(teamLeadId)] : [])])];

  if (!userIds.length) return;

  const staffUsers = await User.find(
    withTenantFilter(tenantId, {
      _id: { $in: userIds },
      role: { $ne: ROLES.ADMIN }
    })
  ).select("_id");

  for (const user of staffUsers) {
    await User.findOneAndUpdate(withTenantFilter(tenantId, { _id: user._id }), { teamId });
  }
};

module.exports = { list, getById, create, update, remove };
