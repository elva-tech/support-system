const ApiError = require("../../shared/utils/ApiError");
const CentralSupportTeam = require("./central-support-team.model");
const CentralSupportUser = require("./central-support-user.model");
const {
  CENTRAL_SUPPORT_ROLES,
  CENTRAL_SUPPORT_USER_STATUSES,
  CENTRAL_SUPPORT_ERROR_CODES
} = require("../../shared/constants/central-support");

const toPublicTeam = async (team) => {
  if (!team) return null;
  const o = team.toObject ? team.toObject() : { ...team };
  const memberIds = (o.memberIds || []).map((id) => String(id));
  const leadId = o.teamLeadId ? String(o.teamLeadId) : null;

  const users = await CentralSupportUser.find({
    _id: { $in: [...memberIds, ...(leadId ? [leadId] : [])] }
  }).select("name email role status teamId");

  const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));

  return {
    id: String(o._id),
    name: o.name,
    description: o.description || "",
    teamLeadId: leadId,
    teamLeadName: leadId && byId[leadId] ? byId[leadId].name : null,
    memberIds,
    members: memberIds.map((id) => {
      const u = byId[id];
      return u
        ? { id: String(u._id), name: u.name, email: u.email, role: u.role, status: u.status }
        : { id, name: "Unknown", email: "", role: "", status: "" };
    }),
    isActive: Boolean(o.isActive),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
};

const listTeams = async ({ includeInactive = false } = {}) => {
  const query = includeInactive ? {} : { isActive: true };
  const teams = await CentralSupportTeam.find(query).sort({ name: 1 });
  return Promise.all(teams.map(toPublicTeam));
};

const getTeam = async (teamId) => {
  const team = await CentralSupportTeam.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found", {
      code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_TEAM_NOT_FOUND
    });
  }
  return toPublicTeam(team);
};

const createTeam = async ({ name, description, teamLeadId, memberIds = [], actor }) => {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new ApiError(400, "Team name is required");

  const clash = await CentralSupportTeam.findOne({ name: trimmed });
  if (clash) throw new ApiError(409, "A team with this name already exists");

  const uniqueMembers = [...new Set((memberIds || []).map(String))];
  if (teamLeadId && !uniqueMembers.includes(String(teamLeadId))) {
    uniqueMembers.push(String(teamLeadId));
  }

  if (uniqueMembers.length) {
    const count = await CentralSupportUser.countDocuments({
      _id: { $in: uniqueMembers },
      status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE
    });
    if (count !== uniqueMembers.length) {
      throw new ApiError(400, "One or more members are invalid or inactive");
    }
  }

  const team = await CentralSupportTeam.create({
    name: trimmed,
    description: String(description || "").trim(),
    teamLeadId: teamLeadId || null,
    memberIds: uniqueMembers,
    isActive: true,
    createdBy: actor?._id || null
  });

  if (uniqueMembers.length) {
    await CentralSupportUser.updateMany(
      { _id: { $in: uniqueMembers } },
      { $set: { teamId: team._id } }
    );
  }
  if (teamLeadId) {
    await CentralSupportUser.updateOne(
      { _id: teamLeadId },
      {
        $set: {
          teamId: team._id,
          role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD
        }
      }
    );
  }

  return toPublicTeam(team);
};

const updateTeam = async ({ teamId, patch, actor }) => {
  const team = await CentralSupportTeam.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found", {
      code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_TEAM_NOT_FOUND
    });
  }

  if (patch.name !== undefined) {
    const trimmed = String(patch.name).trim();
    if (!trimmed) throw new ApiError(400, "Team name is required");
    const clash = await CentralSupportTeam.findOne({ name: trimmed, _id: { $ne: team._id } });
    if (clash) throw new ApiError(409, "A team with this name already exists");
    team.name = trimmed;
  }
  if (patch.description !== undefined) {
    team.description = String(patch.description || "").trim();
  }
  if (patch.isActive !== undefined) {
    team.isActive = Boolean(patch.isActive);
  }

  const prevMembers = (team.memberIds || []).map(String);

  if (patch.memberIds !== undefined || patch.teamLeadId !== undefined) {
    const leadId =
      patch.teamLeadId !== undefined
        ? patch.teamLeadId
          ? String(patch.teamLeadId)
          : null
        : team.teamLeadId
          ? String(team.teamLeadId)
          : null;

    let members =
      patch.memberIds !== undefined
        ? [...new Set((patch.memberIds || []).map(String))]
        : [...prevMembers];

    if (leadId && !members.includes(leadId)) members.push(leadId);

    if (members.length) {
      const count = await CentralSupportUser.countDocuments({
        _id: { $in: members },
        status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE
      });
      if (count !== members.length) {
        throw new ApiError(400, "One or more members are invalid or inactive");
      }
    }

    team.teamLeadId = leadId;
    team.memberIds = members;

    const removed = prevMembers.filter((id) => !members.includes(id));
    if (removed.length) {
      await CentralSupportUser.updateMany(
        { _id: { $in: removed }, teamId: team._id },
        { $set: { teamId: null } }
      );
    }
    if (members.length) {
      await CentralSupportUser.updateMany(
        { _id: { $in: members } },
        { $set: { teamId: team._id } }
      );
    }
    if (leadId) {
      await CentralSupportUser.updateOne(
        { _id: leadId },
        { $set: { role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD, teamId: team._id } }
      );
    }
  }

  await team.save();
  return toPublicTeam(team);
};

const deactivateTeam = async (teamId) => {
  const team = await CentralSupportTeam.findById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found", {
      code: CENTRAL_SUPPORT_ERROR_CODES.CENTRAL_SUPPORT_TEAM_NOT_FOUND
    });
  }
  team.isActive = false;
  await team.save();
  return toPublicTeam(team);
};

module.exports = {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deactivateTeam,
  toPublicTeam
};
