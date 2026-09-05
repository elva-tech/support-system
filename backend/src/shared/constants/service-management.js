/**
 * Tenant service-management defaults (priorities, SLA, escalation, business hours).
 */

const TICKET_PRIORITIES = Object.freeze({
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW"
});

const ALL_TICKET_PRIORITIES = Object.freeze(Object.values(TICKET_PRIORITIES));

const SLA_CLOCK_STATES = Object.freeze({
  ON_TRACK: "ON_TRACK",
  WARNING: "WARNING",
  AT_RISK: "AT_RISK",
  BREACHED: "BREACHED",
  COMPLETED: "COMPLETED",
  NOT_APPLICABLE: "NOT_APPLICABLE"
});

const SLA_METRIC_TYPES = Object.freeze({
  RESPONSE: "RESPONSE",
  RESOLUTION: "RESOLUTION"
});

const ESCALATION_ACTIONS = Object.freeze({
  NOTIFY_ASSIGNEE: "NOTIFY_ASSIGNEE",
  NOTIFY_TEAM_LEAD: "NOTIFY_TEAM_LEAD",
  NOTIFY_ADMIN: "NOTIFY_ADMIN",
  MARK_BREACHED: "MARK_BREACHED"
});

/** Resolution targets in minutes of SLA clock (business-hours for LOW). */
const DEFAULT_SLA_POLICIES = Object.freeze([
  {
    priority: TICKET_PRIORITIES.CRITICAL,
    responseTargetMinutes: 60,
    resolutionTargetMinutes: 24 * 60,
    useBusinessHours: false
  },
  {
    priority: TICKET_PRIORITIES.HIGH,
    responseTargetMinutes: 4 * 60,
    resolutionTargetMinutes: 48 * 60,
    useBusinessHours: false
  },
  {
    priority: TICKET_PRIORITIES.MEDIUM,
    responseTargetMinutes: 8 * 60,
    resolutionTargetMinutes: 72 * 60,
    useBusinessHours: false
  },
  {
    priority: TICKET_PRIORITIES.LOW,
    responseTargetMinutes: 24 * 60,
    resolutionTargetMinutes: 5 * 8 * 60, // 5 business days × 8h
    useBusinessHours: true
  }
]);

const DEFAULT_PRIORITIES = Object.freeze([
  {
    code: TICKET_PRIORITIES.CRITICAL,
    label: "Critical",
    enabled: true,
    customerSelectable: false,
    displayOrder: 1
  },
  {
    code: TICKET_PRIORITIES.HIGH,
    label: "High",
    enabled: true,
    customerSelectable: true,
    displayOrder: 2
  },
  {
    code: TICKET_PRIORITIES.MEDIUM,
    label: "Medium",
    enabled: true,
    customerSelectable: true,
    displayOrder: 3
  },
  {
    code: TICKET_PRIORITIES.LOW,
    label: "Low",
    enabled: true,
    customerSelectable: true,
    displayOrder: 4
  }
]);

const DEFAULT_BUSINESS_HOURS = Object.freeze({
  timezone: "Asia/Kolkata",
  workingDays: [1, 2, 3, 4, 5], // Mon–Fri (JS getDay: 0=Sun)
  startTime: "09:00",
  endTime: "18:00"
});

const DEFAULT_ESCALATION_RULES = Object.freeze([
  {
    metric: SLA_METRIC_TYPES.RESOLUTION,
    thresholdPercent: 50,
    action: ESCALATION_ACTIONS.NOTIFY_ASSIGNEE,
    enabled: true
  },
  {
    metric: SLA_METRIC_TYPES.RESOLUTION,
    thresholdPercent: 75,
    action: ESCALATION_ACTIONS.NOTIFY_TEAM_LEAD,
    enabled: true
  },
  {
    metric: SLA_METRIC_TYPES.RESOLUTION,
    thresholdPercent: 90,
    action: ESCALATION_ACTIONS.NOTIFY_ASSIGNEE,
    enabled: true
  },
  {
    metric: SLA_METRIC_TYPES.RESOLUTION,
    thresholdPercent: 100,
    action: ESCALATION_ACTIONS.MARK_BREACHED,
    enabled: true
  }
]);

const defaultServiceManagement = () => ({
  priorities: DEFAULT_PRIORITIES.map((p) => ({ ...p })),
  businessHours: { ...DEFAULT_BUSINESS_HOURS, workingDays: [...DEFAULT_BUSINESS_HOURS.workingDays] },
  slaPolicies: DEFAULT_SLA_POLICIES.map((p) => ({ ...p })),
  escalationRules: DEFAULT_ESCALATION_RULES.map((r) => ({ ...r })),
  agentMaxActiveTickets: 10
});

module.exports = {
  TICKET_PRIORITIES,
  ALL_TICKET_PRIORITIES,
  SLA_CLOCK_STATES,
  SLA_METRIC_TYPES,
  ESCALATION_ACTIONS,
  DEFAULT_SLA_POLICIES,
  DEFAULT_PRIORITIES,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_ESCALATION_RULES,
  defaultServiceManagement
};
