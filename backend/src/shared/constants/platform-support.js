/**
 * Central ELVA platform support + public collaboration constants.
 * Separate from tenant customer tickets.
 */

const PLATFORM_SUPPORT_CATEGORIES = Object.freeze([
  "TECHNICAL_ISSUE",
  "ACCOUNT_ACCESS",
  "WORKSPACE_CONFIGURATION",
  "APPLICATION_ISSUE",
  "USER_MANAGEMENT",
  "INTEGRATION_ISSUE",
  "BILLING_SUBSCRIPTION",
  "FEATURE_REQUEST",
  "OTHER"
]);

const PLATFORM_SUPPORT_CATEGORY_LABELS = Object.freeze({
  TECHNICAL_ISSUE: "Technical Issue",
  ACCOUNT_ACCESS: "Account / Access",
  WORKSPACE_CONFIGURATION: "Workspace Configuration",
  APPLICATION_ISSUE: "Application Issue",
  USER_MANAGEMENT: "User Management",
  INTEGRATION_ISSUE: "Integration Issue",
  BILLING_SUBSCRIPTION: "Billing / Subscription",
  FEATURE_REQUEST: "Feature Request",
  OTHER: "Other"
});

const PLATFORM_SUPPORT_STATUSES = Object.freeze({
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_FOR_REQUESTER: "WAITING_FOR_REQUESTER",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED"
});

const ALL_PLATFORM_SUPPORT_STATUSES = Object.values(PLATFORM_SUPPORT_STATUSES);

const PLATFORM_SUPPORT_PRIORITIES = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

const ALL_PLATFORM_SUPPORT_PRIORITIES = Object.values(PLATFORM_SUPPORT_PRIORITIES);

/** Default platform-support SLA (minutes). UI shows hours/days via shared formatter. */
const DEFAULT_PLATFORM_SUPPORT_SLA = Object.freeze([
  { priority: "CRITICAL", responseTargetMinutes: 60, resolutionTargetMinutes: 8 * 60 },
  { priority: "HIGH", responseTargetMinutes: 4 * 60, resolutionTargetMinutes: 24 * 60 },
  { priority: "MEDIUM", responseTargetMinutes: 8 * 60, resolutionTargetMinutes: 2 * 24 * 60 },
  { priority: "LOW", responseTargetMinutes: 24 * 60, resolutionTargetMinutes: 3 * 24 * 60 }
]);

const COLLABORATION_ENQUIRY_STATUSES = Object.freeze({
  NEW: "NEW",
  REVIEWED: "REVIEWED",
  CONTACTED: "CONTACTED",
  CLOSED: "CLOSED"
});

module.exports = {
  PLATFORM_SUPPORT_CATEGORIES,
  PLATFORM_SUPPORT_CATEGORY_LABELS,
  PLATFORM_SUPPORT_STATUSES,
  ALL_PLATFORM_SUPPORT_STATUSES,
  PLATFORM_SUPPORT_PRIORITIES,
  ALL_PLATFORM_SUPPORT_PRIORITIES,
  DEFAULT_PLATFORM_SUPPORT_SLA,
  COLLABORATION_ENQUIRY_STATUSES
};
