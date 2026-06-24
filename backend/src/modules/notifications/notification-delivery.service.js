const NotificationDelivery = require("./notification-delivery.model");
const { DELIVERY_STATUS } = require("../../shared/constants/notification-types");
const logger = require("../../shared/utils/logger");

const recordDelivery = async ({ eventId = null, provider, status, errorMessage = null }) => {
  try {
    return await NotificationDelivery.create({
      eventId,
      provider,
      status,
      errorMessage,
      attemptedAt: new Date()
    });
  } catch (error) {
    logger.error("Failed to record notification delivery", {
      eventId: eventId?.toString(),
      provider,
      error: error.message
    });
    return null;
  }
};

const recordSuccess = (provider, eventId = null) =>
  recordDelivery({ eventId, provider, status: DELIVERY_STATUS.SUCCESS });

const recordFailure = (provider, errorMessage, eventId = null) =>
  recordDelivery({ eventId, provider, status: DELIVERY_STATUS.FAILED, errorMessage });

module.exports = { recordDelivery, recordSuccess, recordFailure };
