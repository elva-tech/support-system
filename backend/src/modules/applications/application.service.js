const ApiError = require("../../shared/utils/ApiError");
const Application = require("./application.model");
const { stripClientTenantId, withTenantFilter } = require("../../shared/utils/tenant-scope.util");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");

const actorLabel = (actor) =>
  actor ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email || "Admin" : "Admin";

const auditApp = async (action, application, { tenantId, actor } = {}) => {
  await logAudit({
    entityType: ENTITY_TYPES.APPLICATION,
    entityId: application._id,
    action,
    actorType: ACTOR_TYPES.AGENT,
    actorId: actor?._id || null,
    actorName: actorLabel(actor),
    tenantId,
    metadata: { name: application.name, code: application.code },
    skipNotificationEvent: true
  });
};

const list = async (filters = {}, { tenantId } = {}) => {
  const query = withTenantFilter(tenantId);

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: "i" } },
      { code: { $regex: filters.search, $options: "i" } }
    ];
  }

  return Application.find(query).sort({ name: 1 });
};

const getById = async (id, { tenantId } = {}) => {
  const application = await Application.findOne(withTenantFilter(tenantId, { _id: id }));

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  return application;
};

const create = async (data, { tenantId, actor } = {}) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }

  const payload = stripClientTenantId(data);
  try {
    const application = await Application.create({
      ...payload,
      tenantId,
      code: String(payload.code).toUpperCase()
    });
    await auditApp(AUDIT_ACTIONS.APPLICATION_CREATED, application, { tenantId, actor });
    return application;
  } catch (error) {
    if (error && error.code === 11000) {
      throw new ApiError(409, "Application code already exists for this workspace");
    }
    throw error;
  }
};

const update = async (id, data, { tenantId, actor } = {}) => {
  const application = await getById(id, { tenantId });
  const payload = stripClientTenantId(data);

  if (payload.code) {
    payload.code = String(payload.code).toUpperCase();
  }

  Object.assign(application, payload);
  await application.save();
  await auditApp(AUDIT_ACTIONS.APPLICATION_UPDATED, application, { tenantId, actor });

  return application;
};

const remove = async (id, { tenantId, actor } = {}) => {
  const application = await getById(id, { tenantId });
  await auditApp(AUDIT_ACTIONS.APPLICATION_DELETED, application, { tenantId, actor });
  await application.deleteOne();
  return application;
};

module.exports = { list, getById, create, update, remove };
