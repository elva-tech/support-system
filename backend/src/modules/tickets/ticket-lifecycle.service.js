const ApiError = require("../../shared/utils/ApiError");
const Ticket = require("./ticket.model");
const User = require("../users/user.model");
const Team = require("../teams/team.model");
const { TICKET_STATUSES, ACTIVE_TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const notificationService = require("../notifications/notification.service");
const { WORKER_NOTIFICATION_TYPES } = require("../../shared/constants/notification-types");
const {
  getServiceManagement,
  buildSlaCycle,
  refreshCycleStates,
  TICKET_PRIORITIES
} = require("./sla.service");
const { isUserLoginAllowed } = require("../../shared/constants/user-lifecycle");
const { idsEqual } = require("../tenants/tenant-resolver.service");
const ticketService = require("./ticket.service");

const addSystemEvent = async (ticketId, message) => {
  const conversationService = require("../conversations/conversation.service");
  return conversationService.addSystemEvent(ticketId, message);
};

const startSlaOnTicket = async (ticket, { priority } = {}) => {
  const sm = await getServiceManagement(ticket.tenantId);
  const code = priority || ticket.priority || TICKET_PRIORITIES.MEDIUM;
  ticket.priority = code;
  const cycle = buildSlaCycle(sm, code, new Date(), 1);
  ticket.sla = {
    currentCycle: cycle,
    history: []
  };
  await ticket.save();
  return ticket;
};

const completeCurrentCycle = (ticket, { resolvedAt = null, closedAt = null, outcome = "COMPLETED" } = {}) => {
  if (!ticket.sla?.currentCycle) {
    return;
  }
  const cycle = ticket.sla.currentCycle;
  if (resolvedAt) cycle.resolvedAt = resolvedAt;
  if (closedAt) cycle.closedAt = closedAt;
  cycle.outcome = outcome;
  cycle.resolutionState = outcome === "BREACHED" ? "BREACHED" : "COMPLETED";
  ticket.sla.history = [...(ticket.sla.history || []), { ...cycle.toObject?.() || cycle }];
  ticket.sla.currentCycle = null;
};

/**
 * Agent marks ticket RESOLVED — does not permanently close.
 */
const resolveTicket = async (ticketId, agent, { tenantId, notes } = {}) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found");
  if (tenantId && ticket.tenantId && !idsEqual(ticket.tenantId, tenantId)) {
    throw new ApiError(404, "Ticket not found");
  }
  if (ticket.status === TICKET_STATUSES.CLOSED) {
    throw new ApiError(400, "Closed tickets cannot be resolved; client must reopen first");
  }
  if (ticket.status === TICKET_STATUSES.RESOLVED) {
    return ticketService.getById(ticketId);
  }

  const previousStatus = ticket.status;
  const now = new Date();
  ticket.status = TICKET_STATUSES.RESOLVED;
  ticket.resolvedAt = now;
  ticket.resolvedBy = agent._id;
  ticket.previousAssignedTo = ticket.assignedTo || ticket.previousAssignedTo || null;
  if (notes) {
    ticket.closureNotes = String(notes).trim();
  }

  if (ticket.sla?.currentCycle) {
    const sm = await getServiceManagement(ticket.tenantId);
    refreshCycleStates(ticket.sla.currentCycle, sm, now);
    ticket.sla.currentCycle.resolvedAt = now;
    const breached = Boolean(ticket.sla.currentCycle.resolutionBreachedAt);
    completeCurrentCycle(ticket, {
      resolvedAt: now,
      outcome: breached ? "BREACHED" : "MET"
    });
  }

  ticket.markModified("sla");
  await ticket.save();

  const agentName = `${agent.firstName} ${agent.lastName}`;
  await addSystemEvent(ticketId, `Ticket resolved by ${agentName}`);
  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_RESOLVED,
    actorType: ACTOR_TYPES.AGENT,
    actorId: agent._id,
    actorName: agentName,
    tenantId: ticket.tenantId || null,
    metadata: { ticketNumber: ticket.ticketNumber, previousStatus }
  });

  await notificationService.createEvent(
    WORKER_NOTIFICATION_TYPES.TICKET_RESOLVED,
    ticket._id,
    { ticketNumber: ticket.ticketNumber, previousStatus, newStatus: TICKET_STATUSES.RESOLVED },
    { tenantId: ticket.tenantId || null }
  );

  if (ACTIVE_TICKET_STATUSES.includes(previousStatus) && ticket.assignedTo) {
    const { onAgentPotentiallyFreed } = require("./ticket-auto-assign.service");
    await onAgentPotentiallyFreed(ticket.assignedTo, ticket.teamId);
  }

  return ticketService.getById(ticketId);
};

/**
 * Client closes a resolved ticket.
 */
const clientCloseTicket = async (ticketId, merchant, { tenantId } = {}) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found");
  if (tenantId && ticket.tenantId && !idsEqual(ticket.tenantId, tenantId)) {
    throw new ApiError(404, "Ticket not found");
  }
  if (!idsEqual(ticket.merchantId, merchant._id)) {
    throw new ApiError(403, "Access denied");
  }
  if (ticket.status !== TICKET_STATUSES.RESOLVED) {
    throw new ApiError(400, "Only resolved tickets can be closed by the client");
  }

  const now = new Date();
  ticket.status = TICKET_STATUSES.CLOSED;
  ticket.closedAt = now;
  ticket.closedByMerchantId = merchant._id;
  ticket.closureNotes = ticket.closureNotes || "Closed by client";
  await ticket.save();

  await addSystemEvent(ticketId, "Ticket closed by client");
  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_CLOSED_BY_CLIENT,
    actorType: ACTOR_TYPES.MERCHANT,
    actorId: merchant._id,
    actorName: merchant.merchantName,
    tenantId: ticket.tenantId || null,
    metadata: { ticketNumber: ticket.ticketNumber }
  });

  return ticketService.getById(ticketId);
};

const isPreviousAgentEligible = async (ticket, agentId, sm) => {
  if (!agentId) return { eligible: false, reason: "no_previous_agent" };
  const agent = await User.findById(agentId);
  if (!agent || !isUserLoginAllowed(agent)) {
    return { eligible: false, reason: "inactive" };
  }
  if (!idsEqual(agent.tenantId, ticket.tenantId)) {
    return { eligible: false, reason: "wrong_tenant" };
  }
  if (ticket.teamId && agent.teamId && !idsEqual(agent.teamId, ticket.teamId)) {
    return { eligible: false, reason: "wrong_team" };
  }
  const activeCount = await Ticket.countDocuments({
    tenantId: ticket.tenantId,
    assignedTo: agent._id,
    status: { $in: ACTIVE_TICKET_STATUSES }
  });
  const max = sm.agentMaxActiveTickets ?? 10;
  if (activeCount >= max) {
    return { eligible: false, reason: "at_capacity", activeCount, max };
  }
  return { eligible: true, agent, activeCount, max };
};

/**
 * Client reopens RESOLVED or CLOSED ticket — new SLA cycle + reassignment.
 */
const clientReopenTicket = async (ticketId, merchant, { tenantId, reason } = {}) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new ApiError(404, "Ticket not found");
  if (tenantId && ticket.tenantId && !idsEqual(ticket.tenantId, tenantId)) {
    throw new ApiError(404, "Ticket not found");
  }
  if (!idsEqual(ticket.merchantId, merchant._id)) {
    throw new ApiError(403, "Access denied");
  }
  if (![TICKET_STATUSES.RESOLVED, TICKET_STATUSES.CLOSED].includes(ticket.status)) {
    throw new ApiError(400, "Only resolved or closed tickets can be reopened");
  }

  const sm = await getServiceManagement(ticket.tenantId);
  const previousHandlerId = ticket.previousAssignedTo || ticket.assignedTo || ticket.resolvedBy;
  const previousStatus = ticket.status;
  const now = new Date();

  // Archive any dangling current cycle
  if (ticket.sla?.currentCycle) {
    completeCurrentCycle(ticket, { outcome: "SUPERSEDED" });
  }

  const nextCycleNumber = (ticket.sla?.history?.length || 0) + 1;
  const cycle = buildSlaCycle(sm, ticket.priority || TICKET_PRIORITIES.MEDIUM, now, nextCycleNumber);
  ticket.sla = ticket.sla || { history: [] };
  ticket.sla.currentCycle = cycle;
  ticket.status = TICKET_STATUSES.OPEN;
  ticket.reopenedAt = now;
  ticket.resolvedAt = null;
  ticket.resolvedBy = null;
  ticket.closedAt = null;
  ticket.closedByMerchantId = null;
  ticket.assignedTo = null;
  ticket.assignedAt = null;
  ticket.markModified("sla");
  await ticket.save();

  await addSystemEvent(
    ticketId,
    `Ticket reopened by client${reason ? `: ${String(reason).trim()}` : ""}. SLA cycle ${nextCycleNumber} started.`
  );
  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_REOPENED,
    actorType: ACTOR_TYPES.MERCHANT,
    actorId: merchant._id,
    actorName: merchant.merchantName,
    tenantId: ticket.tenantId || null,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      previousStatus,
      slaCycle: nextCycleNumber,
      reason: reason || null
    }
  });

  const eligibility = await isPreviousAgentEligible(ticket, previousHandlerId, sm);
  const autoAssign = require("./ticket-auto-assign.service");

  if (eligibility.eligible) {
    await autoAssign.assignTicketToAgent(ticket, eligibility.agent, {
      autoAssigned: true,
      fromQueue: false
    });
    await addSystemEvent(
      ticketId,
      `Previous assignee ${eligibility.agent.firstName} ${eligibility.agent.lastName} available — reassigned.`
    );
    await logAudit({
      entityType: ENTITY_TYPES.TICKET,
      entityId: ticket._id,
      action: AUDIT_ACTIONS.TICKET_ASSIGNED,
      actorType: ACTOR_TYPES.SYSTEM,
      actorId: null,
      actorName: "Reopen reassignment",
      tenantId: ticket.tenantId || null,
      metadata: {
        ticketNumber: ticket.ticketNumber,
        mode: "previous_agent",
        agentId: String(eligibility.agent._id)
      }
    });
  } else {
    await addSystemEvent(
      ticketId,
      `Previous assignee unavailable (${eligibility.reason}); using automatic assignment.`
    );
    await autoAssign.autoAssignOnCreate(ticket);
  }

  return ticketService.getById(ticketId);
};

module.exports = {
  startSlaOnTicket,
  resolveTicket,
  clientCloseTicket,
  clientReopenTicket,
  isPreviousAgentEligible,
  completeCurrentCycle
};
