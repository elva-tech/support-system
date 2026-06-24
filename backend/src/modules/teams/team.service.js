const ApiError = require("../../shared/utils/ApiError");
const Team = require("./team.model");
const Application = require("../applications/application.model");
const Module = require("../modules/module.model");
const User = require("../users/user.model");

const populateOptions = [
  { path: "applicationId", select: "name code" },
  { path: "moduleIds", select: "name code" },
  { path: "teamLeadId", select: "firstName lastName email role" },
  { path: "memberIds", select: "firstName lastName email role" }
];

const validateReferences = async ({ applicationId, moduleIds, teamLeadId, memberIds }) => {
  if (applicationId) {
    const application = await Application.findById(applicationId);
    if (!application) {
      throw new ApiError(400, "Application not found");
    }
  }

  if (moduleIds?.length) {
    const modules = await Module.find({ _id: { $in: moduleIds } });
    if (modules.length !== moduleIds.length) {
      throw new ApiError(400, "One or more modules not found");
    }
  }

  const userIds = [...(memberIds || [])];
  if (teamLeadId) {
    userIds.push(teamLeadId);
  }

  if (userIds.length) {
    const users = await User.find({ _id: { $in: userIds } });
    if (users.length !== userIds.length) {
      throw new ApiError(400, "One or more users not found");
    }
  }
};

const list = async (filters = {}) => {
  const query = {};

  if (filters.applicationId) {
    query.applicationId = filters.applicationId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  if (filters.search) {
    query.name = { $regex: filters.search, $options: "i" };
  }

  return Team.find(query).populate(populateOptions).sort({ name: 1 });
};

const getById = async (id) => {
  const team = await Team.findById(id).populate(populateOptions);

  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  return team;
};

const create = async (data) => {
  await validateReferences(data);
  const team = await Team.create(data);
  return Team.findById(team._id).populate(populateOptions);
};

const update = async (id, data) => {
  const team = await getById(id);
  await validateReferences({ ...team.toObject(), ...data });
  Object.assign(team, data);
  await team.save();
  return Team.findById(id).populate(populateOptions);
};

const remove = async (id) => {
  const team = await getById(id);
  await team.deleteOne();
  return team;
};

module.exports = { list, getById, create, update, remove };
