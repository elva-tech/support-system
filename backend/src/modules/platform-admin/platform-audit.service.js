const PlatformAuditLog = require("./platform-audit-log.model");
const {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../../shared/constants/platform");

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

const listPlatformAudit = async ({ action, limit = 50, skip = 0 } = {}) => {
  const query = {};
  if (action) {
    query.action = action;
  }
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeSkip = Math.max(parseInt(skip, 10) || 0, 0);

  const [items, total] = await Promise.all([
    PlatformAuditLog.find(query).sort({ createdAt: -1 }).skip(safeSkip).limit(safeLimit).lean(),
    PlatformAuditLog.countDocuments(query)
  ]);

  return { items, total, limit: safeLimit, skip: safeSkip };
};

module.exports = {
  logPlatformAudit,
  listPlatformAudit,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
};
