const NotificationEvent = require("./notification-event.model");
const NotificationDelivery = require("./notification-delivery.model");
const TicketConversation = require("../conversations/ticket-conversation.model");
const mongoose = require("mongoose");
const { CONVERSATION_SOURCES } = require("../../shared/constants/communication-channels");
const { DELIVERY_STATUS } = require("../../shared/constants/notification-types");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");
const { withTenantFilter } = require("../../shared/utils/tenant-scope.util");
const ApiError = require("../../shared/utils/ApiError");

const requireTenant = (tenantId) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }
};

const toObjectId = (tenantId) =>
  tenantId instanceof mongoose.Types.ObjectId
    ? tenantId
    : new mongoose.Types.ObjectId(String(tenantId));

const countConversationsForTenant = async (tenantId, match = {}) => {
  const result = await TicketConversation.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "tickets",
        localField: "ticketId",
        foreignField: "_id",
        as: "ticket"
      }
    },
    { $unwind: "$ticket" },
    { $match: { "ticket.tenantId": toObjectId(tenantId) } },
    { $count: "total" }
  ]);
  return result[0]?.total || 0;
};

const listDeliveries = async (filters = {}, { tenantId } = {}) => {
  requireTenant(tenantId);
  const { page, limit, skip } = parsePagination(filters);
  const query = withTenantFilter(tenantId);

  if (filters.status) {
    query.status = filters.status;
  }

  const [data, total] = await Promise.all([
    NotificationDelivery.find(query).sort({ attemptedAt: -1 }).skip(skip).limit(limit),
    NotificationDelivery.countDocuments(query)
  ]);

  return { data, pagination: buildPaginationMeta({ page, limit, total }) };
};

const listPendingNotifications = async (filters = {}, { tenantId } = {}) => {
  requireTenant(tenantId);
  const { page, limit, skip } = parsePagination(filters);
  const query = withTenantFilter(tenantId, { processed: false });

  const [data, total] = await Promise.all([
    NotificationEvent.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit),
    NotificationEvent.countDocuments(query)
  ]);

  return { data, pagination: buildPaginationMeta({ page, limit, total }) };
};

const getSummary = async ({ tenantId } = {}) => {
  requireTenant(tenantId);

  const [portalMessages, emailMessages, failedDeliveries, pendingNotifications] = await Promise.all([
    countConversationsForTenant(tenantId, {
      type: "MESSAGE",
      source: CONVERSATION_SOURCES.PORTAL
    }),
    countConversationsForTenant(tenantId, {
      type: "MESSAGE",
      source: CONVERSATION_SOURCES.EMAIL
    }),
    NotificationDelivery.countDocuments(
      withTenantFilter(tenantId, { status: DELIVERY_STATUS.FAILED })
    ),
    NotificationEvent.countDocuments(withTenantFilter(tenantId, { processed: false }))
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
