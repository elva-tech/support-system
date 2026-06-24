const ApiError = require("../../shared/utils/ApiError");
const Module = require("./module.model");
const Application = require("../applications/application.model");
const Team = require("../teams/team.model");

const populateOptions = [
  { path: "applicationId", select: "name code" },
  { path: "defaultTeamId", select: "name" }
];

const list = async (filters = {}) => {
  const query = {};

  if (filters.applicationId) {
    query.applicationId = filters.applicationId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: "i" } },
      { code: { $regex: filters.search, $options: "i" } }
    ];
  }

  return Module.find(query).populate(populateOptions).sort({ name: 1 });
};

const getById = async (id) => {
  const moduleDoc = await Module.findById(id).populate(populateOptions);

  if (!moduleDoc) {
    throw new ApiError(404, "Module not found");
  }

  return moduleDoc;
};

const validateDefaultTeam = async (defaultTeamId) => {
  if (!defaultTeamId) return;

  const team = await Team.findById(defaultTeamId);
  if (!team) {
    throw new ApiError(400, "Default team not found");
  }
};

const create = async (data) => {
  const application = await Application.findById(data.applicationId);

  if (!application) {
    throw new ApiError(400, "Application not found");
  }

  await validateDefaultTeam(data.defaultTeamId);

  const moduleDoc = await Module.create({
    ...data,
    code: data.code.toUpperCase()
  });

  return Module.findById(moduleDoc._id).populate(populateOptions);
};

const update = async (id, data) => {
  const moduleDoc = await getById(id);

  if (data.applicationId) {
    const application = await Application.findById(data.applicationId);

    if (!application) {
      throw new ApiError(400, "Application not found");
    }
  }

  if (data.defaultTeamId !== undefined) {
    await validateDefaultTeam(data.defaultTeamId);
  }

  if (data.code) {
    data.code = data.code.toUpperCase();
  }

  Object.assign(moduleDoc, data);
  await moduleDoc.save();

  return Module.findById(id).populate(populateOptions);
};

const remove = async (id) => {
  const moduleDoc = await getById(id);
  await moduleDoc.deleteOne();
  return moduleDoc;
};

module.exports = { list, getById, create, update, remove };
