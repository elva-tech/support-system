const AuditLog = require("./audit-log.model");
const notificationService = require("../notifications/notification.service");
const logger = require("../../shared/utils/logger");

const logAudit = async ({
  entityType,
  entityId,
  action,
  actorType,
  actorId = null,
  actorName,
  metadata = {},
  tenantId = null,
  skipNotificationEvent = false
}) => {
  try {
    await AuditLog.create({
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
  } catch (error) {
    logger.error("Failed to write audit log", {
      action,
      entityId: entityId?.toString(),
      error: error.message
    });
  }
};

module.exports = { logAudit };
