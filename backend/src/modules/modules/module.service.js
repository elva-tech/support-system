const ApiError = require("../../shared/utils/ApiError");
const Module = require("./module.model");
const Application = require("../applications/application.model");
const Team = require("../teams/team.model");
const { withTenantFilter } = require("../../shared/utils/tenant-scope.util");

const populateOptions = [
  { path: "applicationId", select: "name code tenantId" },
  { path: "defaultTeamId", select: "name" }
];

const assertApplicationInTenant = async (applicationId, tenantId) => {
  const application = await Application.findOne(
    withTenantFilter(tenantId, { _id: applicationId })
  );
  if (!application) {
    throw new ApiError(400, "Application not found");
  }
  return application;
};

const assertTeamInTenant = async (teamId, tenantId) => {
  if (!teamId) {
    return;
  }
  const team = await Team.findOne(withTenantFilter(tenantId, { _id: teamId }));
  if (!team) {
    throw new ApiError(400, "Default team not found");
  }
};

/**
 * Modules inherit tenant scope through their parent Application.
 * All queries resolve via applications belonging to req.tenant.
 */
const list = async (filters = {}, { tenantId } = {}) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }

  const appQuery = withTenantFilter(tenantId);
  if (filters.applicationId) {
    appQuery._id = filters.applicationId;
  }

  const applications = await Application.find(appQuery).select("_id");
  const applicationIds = applications.map((app) => app._id);

  const query = { applicationId: { $in: applicationIds } };

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

const getById = async (id, { tenantId } = {}) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }

  const moduleDoc = await Module.findById(id).populate(populateOptions);
  if (!moduleDoc) {
    throw new ApiError(404, "Module not found");
  }

  const appId =
    moduleDoc.applicationId?._id || moduleDoc.applicationId;
  await assertApplicationInTenant(appId, tenantId);

  return moduleDoc;
};

const create = async (data, { tenantId } = {}) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }

  await assertApplicationInTenant(data.applicationId, tenantId);
  await assertTeamInTenant(data.defaultTeamId, tenantId);

  const moduleDoc = await Module.create({
    name: data.name,
    code: String(data.code).toUpperCase(),
    applicationId: data.applicationId,
    description: data.description || "",
    defaultTeamId: data.defaultTeamId || null,
    isActive: data.isActive !== undefined ? data.isActive : true
  });

  return Module.findById(moduleDoc._id).populate(populateOptions);
};

const update = async (id, data, { tenantId } = {}) => {
  const moduleDoc = await getById(id, { tenantId });

  if (data.applicationId) {
    await assertApplicationInTenant(data.applicationId, tenantId);
    moduleDoc.applicationId = data.applicationId;
  }

  if (data.defaultTeamId !== undefined) {
    await assertTeamInTenant(data.defaultTeamId, tenantId);
    moduleDoc.defaultTeamId = data.defaultTeamId;
  }

  if (data.name !== undefined) {
    moduleDoc.name = data.name;
  }
  if (data.description !== undefined) {
    moduleDoc.description = data.description;
  }
  if (data.isActive !== undefined) {
    moduleDoc.isActive = data.isActive;
  }
  if (data.code) {
    moduleDoc.code = String(data.code).toUpperCase();
  }

  await moduleDoc.save();
  return Module.findById(id).populate(populateOptions);
};

const remove = async (id, { tenantId } = {}) => {
  const moduleDoc = await getById(id, { tenantId });
  await moduleDoc.deleteOne();
  return moduleDoc;
};

module.exports = { list, getById, create, update, remove };
