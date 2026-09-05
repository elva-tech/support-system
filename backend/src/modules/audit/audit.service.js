const AuditLog = require("./audit-log.model");
const logger = require("../../shared/utils/logger");
const notificationService = require("../notifications/notification.service");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");
const { withTenantFilter } = require("../../shared/utils/tenant-scope.util");
const ApiError = require("../../shared/utils/ApiError");

const logAudit = async ({
  entityType,
  entityId,
  action,
  actorType,
  actorId = null,
  actorName = "",
  metadata = {},
  tenantId = null,
  skipNotificationEvent = false
}) => {
  try {
    const entry = await AuditLog.create({
      ...(tenantId ? { tenantId } : {}),
      entityType,
      entityId,
      action,
      actorType,
      actorId,
      actorName,
      metadata
    });

    if (!skipNotificationEvent) {
      await notificationService.createEvent(action, entityId, metadata, { tenantId });
    }

    return entry;
  } catch (err) {
    logger.error("Failed to write audit log", {
      action,
      entityType,
      entityId: entityId?.toString?.() || entityId,
      error: err.message
    });
    return null;
  }
};

/**
 * Tenant-scoped audit log listing (never merges PlatformAuditLog).
 * Fail closed for null tenantId legacy rows.
 */
const listTenantAuditLogs = async (filters = {}, { tenantId } = {}) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }

  const { page, limit, skip } = parsePagination(filters);
  const query = withTenantFilter(tenantId);

  if (filters.action) {
    query.action = filters.action;
  }
  if (filters.entityType) {
    query.entityType = filters.entityType;
  }
  if (filters.entityId) {
    query.entityId = filters.entityId;
  }
  if (filters.search) {
    query.$or = [
      { actorName: { $regex: filters.search, $options: "i" } },
      { action: { $regex: filters.search, $options: "i" } }
    ];
  }

  const [data, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(query)
  ]);

  return { data, pagination: buildPaginationMeta({ page, limit, total }) };
};

module.exports = { logAudit, listTenantAuditLogs };
