/**
 * Tenant integrity diagnostics (Phase 11).
 */

const INTEGRITY_ISSUE_TYPES = Object.freeze({
  MISSING_TENANT: "MISSING_TENANT",
  INVALID_TENANT_REF: "INVALID_TENANT_REF",
  TENANT_MISMATCH: "TENANT_MISMATCH"
});

const INTEGRITY_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

/** Allowlisted logical collection keys for scan/repair. */
const INTEGRITY_COLLECTIONS = Object.freeze({
  users: "users",
  applications: "applications",
  teams: "teams",
  merchantprofiles: "merchantprofiles",
  merchantsessions: "merchantsessions",
  tickets: "tickets",
  ticketsequences: "ticketsequences",
  emailthreads: "emailthreads",
  inboundmailqueues: "inboundmailqueues",
  classificationqueues: "classificationqueues",
  notificationevents: "notificationevents",
  notificationdeliveries: "notificationdeliveries",
  auditlogs: "auditlogs"
});

const ALL_INTEGRITY_COLLECTIONS = Object.values(INTEGRITY_COLLECTIONS);

const MAX_FINDINGS_PER_COLLECTION = 100;
const MAX_AUTO_REPAIR_BATCH = 50;

module.exports = {
  INTEGRITY_ISSUE_TYPES,
  INTEGRITY_SEVERITY,
  INTEGRITY_COLLECTIONS,
  ALL_INTEGRITY_COLLECTIONS,
  MAX_FINDINGS_PER_COLLECTION,
  MAX_AUTO_REPAIR_BATCH
};
