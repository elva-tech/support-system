const Tenant = require("../tenants/tenant.model");
const {
  TICKET_PRIORITIES,
  ALL_TICKET_PRIORITIES,
  SLA_CLOCK_STATES,
  SLA_METRIC_TYPES,
  defaultServiceManagement
} = require("../../shared/constants/service-management");
const { addSlaMinutes, elapsedSlaMinutes, percentConsumed } = require("../../shared/utils/business-hours.util");

const getServiceManagement = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).select("settings").lean();
  const defaults = defaultServiceManagement();
  const configured = tenant?.settings?.serviceManagement || {};
  return {
    priorities: configured.priorities?.length ? configured.priorities : defaults.priorities,
    businessHours: { ...defaults.businessHours, ...(configured.businessHours || {}) },
    slaPolicies: configured.slaPolicies?.length ? configured.slaPolicies : defaults.slaPolicies,
    escalationRules: configured.escalationRules?.length
      ? configured.escalationRules
      : defaults.escalationRules,
    agentMaxActiveTickets:
      configured.agentMaxActiveTickets ?? defaults.agentMaxActiveTickets
  };
};

const ensureServiceManagementDefaults = async (tenantDoc) => {
  if (!tenantDoc) return null;
  tenantDoc.settings = tenantDoc.settings || {};
  if (!tenantDoc.settings.serviceManagement) {
    tenantDoc.settings.serviceManagement = defaultServiceManagement();
    tenantDoc.markModified("settings");
    await tenantDoc.save();
  }
  return tenantDoc.settings.serviceManagement;
};

const resolvePriorityPolicy = (sm, priorityCode) => {
  const code = ALL_TICKET_PRIORITIES.includes(priorityCode)
    ? priorityCode
    : TICKET_PRIORITIES.MEDIUM;
  const policy =
    (sm.slaPolicies || []).find((p) => p.priority === code) ||
    (sm.slaPolicies || []).find((p) => p.priority === TICKET_PRIORITIES.MEDIUM);
  return { priority: code, policy };
};

const customerAllowedPriorities = (sm) =>
  (sm.priorities || [])
    .filter((p) => p.enabled !== false && p.customerSelectable)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .map((p) => p.code);

const buildSlaCycle = (sm, priority, startedAt = new Date(), cycleNumber = 1) => {
  const { policy } = resolvePriorityPolicy(sm, priority);
  const useBh = Boolean(policy?.useBusinessHours);
  const responseTarget = policy?.responseTargetMinutes ?? 8 * 60;
  const resolutionTarget = policy?.resolutionTargetMinutes ?? 72 * 60;
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);

  return {
    cycleNumber,
    priority,
    startedAt: start,
    responseTargetMinutes: responseTarget,
    resolutionTargetMinutes: resolutionTarget,
    useBusinessHours: useBh,
    responseDueAt: addSlaMinutes(start, responseTarget, sm.businessHours, {
      useBusinessHours: useBh
    }),
    resolutionDueAt: addSlaMinutes(start, resolutionTarget, sm.businessHours, {
      useBusinessHours: useBh
    }),
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    responseState: SLA_CLOCK_STATES.ON_TRACK,
    resolutionState: SLA_CLOCK_STATES.ON_TRACK,
    responseBreachedAt: null,
    resolutionBreachedAt: null,
    triggeredThresholds: [],
    outcome: null
  };
};

const refreshCycleStates = (cycle, sm, now = new Date()) => {
  if (!cycle || cycle.outcome) {
    return cycle;
  }

  const useBh = Boolean(cycle.useBusinessHours);
  const elapsedResponse = elapsedSlaMinutes(cycle.startedAt, cycle.firstResponseAt || now, sm.businessHours, {
    useBusinessHours: useBh
  });
  const elapsedResolution = elapsedSlaMinutes(cycle.startedAt, cycle.resolvedAt || now, sm.businessHours, {
    useBusinessHours: useBh
  });

  const responsePct = cycle.firstResponseAt
    ? percentConsumed(elapsedResponse, cycle.responseTargetMinutes)
    : percentConsumed(elapsedResponse, cycle.responseTargetMinutes);
  const resolutionPct = percentConsumed(elapsedResolution, cycle.resolutionTargetMinutes);

  const stateFromPct = (pct, completed) => {
    if (completed) return SLA_CLOCK_STATES.COMPLETED;
    if (pct >= 100) return SLA_CLOCK_STATES.BREACHED;
    if (pct >= 90) return SLA_CLOCK_STATES.AT_RISK;
    if (pct >= 75) return SLA_CLOCK_STATES.WARNING;
    return SLA_CLOCK_STATES.ON_TRACK;
  };

  cycle.responsePercent = responsePct;
  cycle.resolutionPercent = resolutionPct;
  cycle.responseState = stateFromPct(responsePct, Boolean(cycle.firstResponseAt));
  cycle.resolutionState = stateFromPct(resolutionPct, Boolean(cycle.resolvedAt));

  if (!cycle.firstResponseAt && responsePct >= 100 && !cycle.responseBreachedAt) {
    cycle.responseBreachedAt = now;
  }
  if (!cycle.resolvedAt && resolutionPct >= 100 && !cycle.resolutionBreachedAt) {
    cycle.resolutionBreachedAt = now;
  }

  return cycle;
};

const attachSlaPublicView = (ticket, sm, now = new Date()) => {
  const cycle = ticket?.sla?.currentCycle
    ? refreshCycleStates({ ...ticket.sla.currentCycle }, sm, now)
    : null;
  if (!cycle) {
    return {
      priority: ticket?.priority || TICKET_PRIORITIES.MEDIUM,
      hasSla: false,
      currentCycle: null
    };
  }

  const remainingResolutionMs = cycle.resolvedAt
    ? 0
    : Math.max(0, new Date(cycle.resolutionDueAt).getTime() - now.getTime());

  return {
    priority: ticket.priority || cycle.priority,
    hasSla: true,
    currentCycle: {
      cycleNumber: cycle.cycleNumber,
      startedAt: cycle.startedAt,
      responseDueAt: cycle.responseDueAt,
      resolutionDueAt: cycle.resolutionDueAt,
      firstResponseAt: cycle.firstResponseAt,
      resolvedAt: cycle.resolvedAt,
      responseState: cycle.responseState,
      resolutionState: cycle.resolutionState,
      responsePercent: cycle.responsePercent,
      resolutionPercent: cycle.resolutionPercent,
      responseBreachedAt: cycle.responseBreachedAt,
      resolutionBreachedAt: cycle.resolutionBreachedAt,
      remainingResolutionMinutes: Math.round(remainingResolutionMs / 60000),
      triggeredThresholds: cycle.triggeredThresholds || []
    }
  };
};

module.exports = {
  getServiceManagement,
  ensureServiceManagementDefaults,
  resolvePriorityPolicy,
  customerAllowedPriorities,
  buildSlaCycle,
  refreshCycleStates,
  attachSlaPublicView,
  TICKET_PRIORITIES,
  SLA_CLOCK_STATES,
  SLA_METRIC_TYPES
};
