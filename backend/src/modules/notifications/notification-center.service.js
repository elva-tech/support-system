const NotificationEvent = require("./notification-event.model");
const NotificationDelivery = require("./notification-delivery.model");
const TicketConversation = require("../conversations/ticket-conversation.model");
const { CONVERSATION_SOURCES } = require("../../shared/constants/communication-channels");
const { DELIVERY_STATUS } = require("../../shared/constants/notification-types");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");

const listDeliveries = async (filters = {}) => {
  const { page, limit, skip } = parsePagination(filters);
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }

  const [data, total] = await Promise.all([
    NotificationDelivery.find(query).sort({ attemptedAt: -1 }).skip(skip).limit(limit),
    NotificationDelivery.countDocuments(query)
  ]);

  return { data, pagination: buildPaginationMeta({ page, limit, total }) };
};

const listPendingNotifications = async (filters = {}) => {
  const { page, limit, skip } = parsePagination(filters);

  const [data, total] = await Promise.all([
    NotificationEvent.find({ processed: false }).sort({ createdAt: 1 }).skip(skip).limit(limit),
    NotificationEvent.countDocuments({ processed: false })
  ]);

  return { data, pagination: buildPaginationMeta({ page, limit, total }) };
};

const getSummary = async () => {
  const [portalMessages, emailMessages, failedDeliveries, pendingNotifications] = await Promise.all([
    TicketConversation.countDocuments({
      type: "MESSAGE",
      source: CONVERSATION_SOURCES.PORTAL
    }),
    TicketConversation.countDocuments({
      type: "MESSAGE",
      source: CONVERSATION_SOURCES.EMAIL
    }),
    NotificationDelivery.countDocuments({ status: DELIVERY_STATUS.FAILED }),
    NotificationEvent.countDocuments({ processed: false })
  ]);

  return {
    portalMessages,
    emailMessages,
    failedDeliveries,
    pendingNotifications
  };
};

module.exports = {
  listDeliveries,
  listPendingNotifications,
  getSummary
};
