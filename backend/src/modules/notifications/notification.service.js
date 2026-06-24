const NotificationEvent = require("./notification-event.model");
const { NOTIFICATION_EVENT_TYPES } = require("./notification-event.model");
const logger = require("../../shared/utils/logger");

const createEvent = async (eventType, entityId, metadata = {}) => {
  if (!NOTIFICATION_EVENT_TYPES.includes(eventType)) {
    return;
  }

  try {
    await NotificationEvent.create({
      eventType,
      entityId,
      processed: false,
      metadata
    });
  } catch (error) {
    logger.error("Failed to create notification event", {
      eventType,
      entityId: entityId?.toString(),
      error: error.message
    });
  }
};

module.exports = { createEvent };
