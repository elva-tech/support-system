const NotificationEvent = require("./notification-event.model");
const Ticket = require("../tickets/ticket.model");
require("../merchants/merchant-profile.model");
const notificationManager = require("./notification-manager.service");
const emailThreadService = require("../email/email-thread.service");
const {
  WORKER_NOTIFICATION_TYPES
} = require("../../shared/constants/notification-types");
const { TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");
const env = require("../../config/env");
const {
  renderTicketCreatedEmail,
  renderTicketAssignedEmail,
  renderTicketClosedEmail
} = require("./email-templates");
const logger = require("../../shared/utils/logger");

const WORKER_TYPE_LIST = Object.values(WORKER_NOTIFICATION_TYPES);

const shouldSkipEvent = (event) => {
  if (event.eventType === WORKER_NOTIFICATION_TYPES.AGENT_REPLY) {
    return true;
  }

  if (
    event.eventType === WORKER_NOTIFICATION_TYPES.STATUS_CHANGED &&
    event.metadata?.newStatus === TICKET_STATUSES.RESOLVED
  ) {
    return true;
  }

  return false;
};

const buildDeliveryPayload = async (event) => {
  const ticket = await Ticket.findById(event.entityId).populate([
    { path: "merchantId", select: "email merchantName phone" },
    { path: "assignedTo", select: "firstName lastName" }
  ]);

  if (!ticket || !ticket.merchantId) {
    throw new Error(`Ticket or merchant not found for event ${event._id}`);
  }

  const merchant = ticket.merchantId;
  const ticketNumber = ticket.ticketNumber;
  const ticketTag = emailThreadService.formatTicketTag(ticketNumber);
  const messageId = emailThreadService.generateMessageId(ticketNumber);
  const threadContext = await emailThreadService.getThreadContext(ticket._id);

  const withThread = (subject, body, { html } = {}) => ({
    eventType: event.eventType,
    recipientEmail: merchant.email,
    recipientPhone: merchant.phone || null,
    subject: subject.includes(ticketTag) ? subject : `${ticketTag} ${subject}`,
    body,
    html,
    headers: {
      "Message-ID": messageId,
      ...(threadContext.inReplyTo ? { "In-Reply-To": threadContext.inReplyTo } : {}),
      ...(threadContext.references?.length
        ? { References: threadContext.references.join(" ") }
        : {})
    },
    replyTo: env.email.supportAddress,
    from: env.email.supportAddress,
    emailThread: {
      ticketId: ticket._id,
      conversationId: null,
      messageId,
      inReplyTo: threadContext.inReplyTo,
      references: threadContext.references,
      subject: subject.includes(ticketTag) ? subject : `${ticketTag} ${subject}`
    },
    metadata: {
      ticketId: ticket._id.toString(),
      ticketNumber,
      merchantName: merchant.merchantName,
      ...event.metadata
    }
  });

  const templates = {
    [WORKER_NOTIFICATION_TYPES.TICKET_CREATED]: withThread(
      `Ticket ${ticketNumber} created`,
      `Your support ticket "${ticket.subject}" has been created.`,
      {
        html: renderTicketCreatedEmail({
          ticketNumber,
          subject: ticket.subject,
          merchantName: merchant.merchantName,
          message: ticket.description,
          senderName: merchant.merchantName,
          ticket
        })
      }
    ),
    [WORKER_NOTIFICATION_TYPES.TICKET_ASSIGNED]: withThread(
      `Ticket ${ticketNumber} assigned`,
      `Your ticket "${ticket.subject}" has been assigned to ${
        event.metadata?.assignedToName || "a support agent"
      }.`,
      {
        html: renderTicketAssignedEmail({
          ticketNumber,
          subject: ticket.subject,
          merchantName: merchant.merchantName,
          agentName: event.metadata?.assignedToName || "our support team"
        })
      }
    ),
    [WORKER_NOTIFICATION_TYPES.AGENT_REPLY]: withThread(
      `New reply on ticket ${ticketNumber}`,
      event.metadata?.message || "An agent has replied to your ticket."
    ),
    [WORKER_NOTIFICATION_TYPES.STATUS_CHANGED]: (() => {
      const newStatus = event.metadata?.newStatus || ticket.status;
      if (newStatus === TICKET_STATUSES.CLOSED) {
        return withThread(
          `Ticket ${ticketNumber} closed`,
          `Your support ticket "${ticket.subject}" has been closed.`,
          {
            html: renderTicketClosedEmail({
              ticketNumber,
              subject: ticket.subject,
              merchantName: merchant.merchantName,
              closureNotes: event.metadata?.closureNotes || ticket.closureNotes || null
            })
          }
        );
      }

      return withThread(
        `Ticket ${ticketNumber} status updated`,
        `Your ticket status changed to ${newStatus}.`
      );
    })(),
    [WORKER_NOTIFICATION_TYPES.TICKET_RESOLVED]: withThread(
      `Ticket ${ticketNumber} resolved`,
      `Your support ticket "${ticket.subject}" has been resolved.`
    )
  };

  const template = templates[event.eventType] || withThread(
    `Update on ticket ${ticketNumber}`,
    "There is an update on your support ticket."
  );

  return template;
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
