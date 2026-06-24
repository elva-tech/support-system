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
  metadata = {}
}) => {
  try {
    await AuditLog.create({
      entityType,
      entityId,
      action,
      actorType,
      actorId,
      actorName,
      metadata
    });

    await notificationService.createEvent(action, entityId, metadata);
  } catch (error) {
    logger.error("Failed to write audit log", {
      action,
      entityId: entityId?.toString(),
      error: error.message
    });
  }
};

module.exports = { logAudit };
