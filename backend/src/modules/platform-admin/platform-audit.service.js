const PlatformAuditLog = require("./platform-audit-log.model");
const {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../../shared/constants/platform");
const { toPublicAuditLog } = require("../audit/audit-redaction.util");
const mongoose = require("mongoose");

/**
 * Persist a platform audit event. Never include passwords or secrets in metadata.
 */
const logPlatformAudit = async ({
  actorPlatformAdminId = null,
  actorEmail = "",
  action,
  targetType,
  targetId = null,
  metadata = {}
}) => {
  if (!Object.values(PLATFORM_AUDIT_ACTIONS).includes(action)) {
    throw new Error(`Unknown platform audit action: ${action}`);
  }
  if (!Object.values(PLATFORM_AUDIT_TARGET_TYPES).includes(targetType)) {
    throw new Error(`Unknown platform audit target type: ${targetType}`);
  }

  return PlatformAuditLog.create({
    actorPlatformAdminId,
    actorEmail: actorEmail || "",
    action,
    targetType,
    targetId,
    metadata: metadata || {}
  });
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listPlatformAudit = async (filters = {}) => {
  const query = {};
  if (filters.action) {
    query.action = filters.action;
  }
  if (filters.targetType) {
    query.targetType = filters.targetType;
  }
  if (filters.actorPlatformAdminId && mongoose.Types.ObjectId.isValid(filters.actorPlatformAdminId)) {
    query.actorPlatformAdminId = filters.actorPlatformAdminId;
  }
  if (filters.targetId && mongoose.Types.ObjectId.isValid(filters.targetId)) {
    query.targetId = filters.targetId;
  }
  if (filters.tenantId && mongoose.Types.ObjectId.isValid(filters.tenantId)) {
    query["metadata.tenantId"] = String(filters.tenantId);
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
    query.$or = [{ actorEmail: rx }, { action: rx }, { targetType: rx }];
  }

  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);
  const skip =
    filters.skip !== undefined && filters.skip !== ""
      ? Math.max(parseInt(filters.skip, 10) || 0, 0)
      : (page - 1) * limit;

  const [items, total] = await Promise.all([
    PlatformAuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PlatformAuditLog.countDocuments(query)
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      metadata: toPublicAuditLog(item)?.metadata || {}
    })),
    total,
    limit,
    skip,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit)
  };
};

module.exports = {
  logPlatformAudit,
  listPlatformAudit,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
};
