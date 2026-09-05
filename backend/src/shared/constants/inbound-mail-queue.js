const INBOUND_MAIL_QUEUE_STATUS = Object.freeze({
  PENDING: "PENDING",
  ASSIGNED: "ASSIGNED",
  REJECTED: "REJECTED"
});

/** Tenant routing outcome for central-mailbox inbound messages (Phase 8). */
const INBOUND_MAIL_ROUTING_STATUS = Object.freeze({
  RESOLVED: "RESOLVED",
  UNRESOLVED: "UNRESOLVED",
  AMBIGUOUS: "AMBIGUOUS",
  FAILED: "FAILED"
});

module.exports = {
  INBOUND_MAIL_QUEUE_STATUS,
  INBOUND_MAIL_ROUTING_STATUS
};
