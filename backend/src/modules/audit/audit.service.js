const mongoose = require("mongoose");
const AuditLog = require("./audit-log.model");
const logger = require("../../shared/utils/logger");
const notificationService = require("../notifications/notification.service");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");
const { withTenantFilter } = require("../../shared/utils/tenant-scope.util");
const ApiError = require("../../shared/utils/ApiError");
const { toPublicAuditLog } = require("./audit-redaction.util");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
      metadata: metadata || {}
    });

    if (!skipNotificationEvent) {
      await notificationService.createEvent(action, entityId, metadata || {}, { tenantId });
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
  if (filters.actorId && mongoose.Types.ObjectId.isValid(filters.actorId)) {
    query.actorId = filters.actorId;
  }
  if (filters.entityId && mongoose.Types.ObjectId.isValid(filters.entityId)) {
    query.entityId = filters.entityId;
  }

  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) {
        query.createdAt.$gte = from;
      }
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) {
        query.createdAt.$lte = to;
      }
    }
    if (!Object.keys(query.createdAt).length) {
      delete query.createdAt;
    }
  }

  const search = String(filters.search || "").trim().slice(0, 80);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { actorName: rx },
      { action: rx },
      { entityType: rx },
      { "metadata.ticketNumber": rx },
      { "metadata.email": rx }
    ];
  }

  const [rows, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(query)
  ]);

  return {
    data: rows.map(toPublicAuditLog),
    pagination: buildPaginationMeta({ page, limit, total })
  };
};

const getTenantAuditLogById = async (id, { tenantId } = {}) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }
  const entry = await AuditLog.findOne(withTenantFilter(tenantId, { _id: id })).lean();
  if (!entry) {
    throw new ApiError(404, "Audit log not found");
  }
  return toPublicAuditLog(entry);
};

module.exports = { logAudit, listTenantAuditLogs, getTenantAuditLogById };
