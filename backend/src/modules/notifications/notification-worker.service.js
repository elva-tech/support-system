const NotificationEvent = require("./notification-event.model");
const Ticket = require("../tickets/ticket.model");
require("../merchants/merchant-profile.model");
const notificationManager = require("./notification-manager.service");
const {
  WORKER_NOTIFICATION_TYPES
} = require("../../shared/constants/notification-types");
const { TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");

const WORKER_TYPE_LIST = Object.values(WORKER_NOTIFICATION_TYPES);

const shouldSkipEvent = (event) => {
  if (
    event.eventType === WORKER_NOTIFICATION_TYPES.STATUS_CHANGED &&
    event.metadata?.newStatus === TICKET_STATUSES.RESOLVED
  ) {
    return true;
  }

  return false;
};

const buildDeliveryPayload = async (event) => {
  const ticket = await Ticket.findById(event.entityId).populate(
    "merchantId",
    "email merchantName phone"
  );

  if (!ticket || !ticket.merchantId) {
    throw new Error(`Ticket or merchant not found for event ${event._id}`);
  }

  const merchant = ticket.merchantId;
  const ticketNumber = ticket.ticketNumber;
  const templates = {
    [WORKER_NOTIFICATION_TYPES.TICKET_CREATED]: {
      subject: `Ticket ${ticketNumber} created`,
      body: `Your support ticket "${ticket.subject}" has been created.`
    },
    [WORKER_NOTIFICATION_TYPES.AGENT_REPLY]: {
      subject: `New reply on ticket ${ticketNumber}`,
      body: event.metadata?.message || "An agent has replied to your ticket."
    },
    [WORKER_NOTIFICATION_TYPES.STATUS_CHANGED]: {
      subject: `Ticket ${ticketNumber} status updated`,
      body: `Your ticket status changed to ${event.metadata?.newStatus || ticket.status}.`
    },
    [WORKER_NOTIFICATION_TYPES.TICKET_RESOLVED]: {
      subject: `Ticket ${ticketNumber} resolved`,
      body: `Your support ticket "${ticket.subject}" has been resolved.`
    }
  };

  const template = templates[event.eventType] || {
    subject: `Update on ticket ${ticketNumber}`,
    body: `There is an update on your support ticket.`
  };

  return {
    eventType: event.eventType,
    recipientEmail: merchant.email,
    recipientPhone: merchant.phone || null,
    subject: template.subject,
    body: template.body,
    metadata: {
      ticketId: ticket._id.toString(),
      ticketNumber,
      merchantName: merchant.merchantName,
      ...event.metadata
    }
  };
};

const processBatch = async () => {
  const events = await NotificationEvent.find({
    processed: false,
    eventType: { $in: WORKER_TYPE_LIST }
  })
    .sort({ createdAt: 1 })
    .limit(env.notifications.worker.batchSize);

  for (const event of events) {
    if (shouldSkipEvent(event)) {
      await NotificationEvent.findByIdAndUpdate(event._id, { processed: true });
      continue;
    }

    try {
      const deliveryPayload = await buildDeliveryPayload(event);
      await notificationManager.sendNotification({ ...event.toObject(), deliveryPayload });
    } catch (error) {
      logger.error("Notification worker failed to process event", {
        eventId: event._id.toString(),
        eventType: event.eventType,
        error: error.message
      });
      await NotificationEvent.findByIdAndUpdate(event._id, { processed: true });
    }
  }
};

let intervalHandle = null;

const start = () => {
  if (!env.notifications.worker.enabled) {
    logger.info("Notification worker is disabled");
    return;
  }

  if (intervalHandle) {
    return;
  }

  logger.info("Notification worker started", {
    pollIntervalMs: env.notifications.worker.pollIntervalMs,
    batchSize: env.notifications.worker.batchSize
  });

  processBatch().catch((error) => {
    logger.error("Notification worker initial poll failed", { error: error.message });
  });

  intervalHandle = setInterval(() => {
    processBatch().catch((error) => {
      logger.error("Notification worker poll failed", { error: error.message });
    });
  }, env.notifications.worker.pollIntervalMs);
};

const stop = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("Notification worker stopped");
  }
};

module.exports = { start, stop, processBatch, buildDeliveryPayload, shouldSkipEvent };
