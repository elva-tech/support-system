const ApiError = require("../../shared/utils/ApiError");
const resolveRefId = require("../../shared/utils/resolve-ref-id");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");
const Ticket = require("./ticket.model");
const Module = require("../modules/module.model");
const { generateTicketNumber } = require("./ticket-number.service");
const { buildQueueQuery, applySearchFilter } = require("./ticket-query.util");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const {
  TICKET_STATUSES,
  ACTIVE_TICKET_STATUSES
} = require("../../shared/constants/ticket-statuses");
const { resolveTeamForApplication } = require("../teams/application-team-routing.service");

const populateOptions = [
  { path: "applicationId", select: "name code" },
  { path: "moduleId", select: "name code" },
  { path: "merchantId", select: "merchantName email" },
  { path: "teamId", select: "name" },
  { path: "assignedTo", select: "firstName lastName email role" }
];

const listModulesForMerchant = async (merchant) => {
  return Module.find({
    applicationId: merchant.applicationId,
    isActive: true
  })
    .select("name code")
    .sort({ name: 1 });
};

const createForMerchant = async (merchant, data, { tenantId } = {}) => {
  const resolvedTenantId = merchant.tenantId || tenantId;
  if (!resolvedTenantId) {
    throw new ApiError(400, "Tenant context is required");
  }

  const moduleDoc = await Module.findOne({
    _id: data.moduleId,
    applicationId: merchant.applicationId,
    isActive: true
  });

  if (!moduleDoc) {
    throw new ApiError(400, "Invalid module for your application");
  }

  const teamId = data.teamId || (await resolveTeamForApplication(merchant.applicationId));

  if (data.teamId) {
    const Team = require("../teams/team.model");
    const team = await Team.findOne({
      _id: data.teamId,
      isActive: true,
      tenantId: resolvedTenantId
    });
    if (!team) {
      throw new ApiError(400, "Selected team not found");
    }
  }

  const ticketNumber = await generateTicketNumber(merchant.applicationCode, resolvedTenantId);

  const ticket = await Ticket.create({
    tenantId: resolvedTenantId,
    ticketNumber,
    applicationId: merchant.applicationId,
    applicationCode: merchant.applicationCode,
    moduleId: moduleDoc._id,
    merchantId: merchant._id,
    teamId,
    subject: data.subject,
    description: data.description,
    status: TICKET_STATUSES.OPEN,
    ...(data.source ? { source: data.source } : {}),
    ...(data.channelMetadata ? { channelMetadata: data.channelMetadata } : {})
  });

  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_CREATED,
    actorType: ACTOR_TYPES.MERCHANT,
    actorId: merchant._id,
    actorName: merchant.merchantName,
    tenantId: resolvedTenantId,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      moduleId: moduleDoc._id.toString()
    },
    skipNotificationEvent: data.skipTicketCreatedNotification === true
  });

  const { autoAssignOnCreate } = require("./ticket-auto-assign.service");
  await autoAssignOnCreate(ticket);

  return Ticket.findOne({ _id: ticket._id, tenantId: resolvedTenantId }).populate(populateOptions);
};

const createFromChannel = async ({
  merchant,
  moduleId,
  subject,
  description,
  source = "PORTAL",
  channelMetadata = {}
}) => {
  const ticket = await createForMerchant(merchant, {
    moduleId,
    subject,
    description,
    source,
    channelMetadata,
    skipTicketCreatedNotification: true
  });

  const emailOutboundService = require("../email/email-outbound.service");
  await emailOutboundService.sendTimelineEmail({
    ticket,
    merchant: ticket.merchantId,
    message: description,
    senderName: merchant.merchantName,
    senderType: "MERCHANT",
    conversationId: null,
    isNewTicket: true
  });

  return ticket;
};

const listForMerchant = async (merchantId, { tenantId } = {}) => {
  const query = { merchantId };
  if (tenantId) {
    query.tenantId = tenantId;
  }

  return Ticket.find(query)
    .populate(populateOptions)
    .sort({ createdAt: -1 });
};

const getForMerchant = async (merchantId, ticketId, { tenantId } = {}) => {
  const query = { _id: ticketId, merchantId };
  if (tenantId) {
    query.tenantId = tenantId;
  }

  const ticket = await Ticket.findOne(query).populate(populateOptions);

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  return ticket;
};

const getStatsForMerchant = async (merchantId, { tenantId } = {}) => {
  const query = { merchantId };
  if (tenantId) {
    query.tenantId = tenantId;
  }

  const tickets = await Ticket.find(query).select("status");

  return {
    open: tickets.filter((t) => ACTIVE_TICKET_STATUSES.includes(t.status)).length,
    resolved: tickets.filter((t) => t.status === TICKET_STATUSES.RESOLVED).length,
    closed: tickets.filter((t) => t.status === TICKET_STATUSES.CLOSED).length
  };
};

const paginateTickets = async (baseQuery, filters = {}, { tenantId } = {}) => {
  const { page, limit, skip } = parsePagination(filters);
  let query = buildQueueQuery(filters);
  query = await applySearchFilter(query, filters.search, { tenantId });

  const finalQuery = Object.keys(baseQuery).length
    ? { $and: [baseQuery, query] }
  : query;

  const [data, total] = await Promise.all([
    Ticket.find(finalQuery).populate(populateOptions).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Ticket.countDocuments(finalQuery)
  ]);

  return {
    data,
    pagination: buildPaginationMeta(page, limit, total)
  };
};

const listAll = async (user, filters = {}, { tenantId } = {}) => {
  const baseQuery = {};
  if (tenantId) {
    baseQuery.tenantId = tenantId;
  }

  const { ROLES } = require("../../shared/constants/roles");

  if (user.role !== ROLES.ADMIN) {
    if (!user.teamId) {
      throw new ApiError(400, "You are not assigned to a team");
    }
    baseQuery.teamId = resolveRefId(user.teamId);
  }

  return paginateTickets(baseQuery, filters, { tenantId });
};

const listMyTickets = async (userId, filters = {}, { tenantId } = {}) => {
  const baseQuery = { assignedTo: userId };
  if (tenantId) {
    baseQuery.tenantId = tenantId;
  }
  return paginateTickets(baseQuery, filters, { tenantId });
};

const listTeamTickets = async (user, filters = {}, { tenantId } = {}) => {
  const baseQuery = {};
  if (tenantId) {
    baseQuery.tenantId = tenantId;
  }

  const { ROLES } = require("../../shared/constants/roles");

  if (user.role !== ROLES.ADMIN) {
    if (!user.teamId) {
      throw new ApiError(400, "You are not assigned to a team");
    }
    baseQuery.teamId = resolveRefId(user.teamId);
  } else if (filters.team) {
    baseQuery.teamId = filters.team;
  }

  return paginateTickets(baseQuery, filters, { tenantId });
};

const getById = async (ticketId, { tenantId } = {}) => {
  const query = tenantId ? { _id: ticketId, tenantId } : { _id: ticketId };
  const ticket = await Ticket.findOne(query).populate(populateOptions);

  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  return ticket;
};

module.exports = {
  listModulesForMerchant,
  createForMerchant,
  createFromChannel,
  listForMerchant,
  getForMerchant,
  getStatsForMerchant,
  listAll,
  listMyTickets,
  listTeamTickets,
  getById,
  populateOptions
};
