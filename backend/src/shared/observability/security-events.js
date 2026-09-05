const logger = require("../utils/logger");
const { recordAuthFailure, recordRateLimited } = require("./metrics");

/**
 * Security / operational event logger (Phase 14).
 * Structured events for investigation — not tenant AuditLog duplicates.
 */

const SECURITY_EVENTS = Object.freeze({
  AUTH_LOGIN_FAILED: "AUTH_LOGIN_FAILED",
  AUTH_LOGIN_SUCCEEDED: "AUTH_LOGIN_SUCCEEDED",
  AUTH_RATE_LIMITED: "AUTH_RATE_LIMITED",
  PLATFORM_LOGIN_FAILED: "PLATFORM_LOGIN_FAILED",
  PLATFORM_LOGIN_SUCCEEDED: "PLATFORM_LOGIN_SUCCEEDED",
  INVITATION_TOKEN_INVALID: "INVITATION_TOKEN_INVALID",
  INVITATION_TOKEN_EXPIRED: "INVITATION_TOKEN_EXPIRED",
  CROSS_TENANT_ACCESS_BLOCKED: "CROSS_TENANT_ACCESS_BLOCKED",
  INVALID_TENANT_HOST: "INVALID_TENANT_HOST",
  TENANT_HEADER_OVERRIDE_ATTEMPT: "TENANT_HEADER_OVERRIDE_ATTEMPT",
  PLATFORM_TOKEN_TENANT_API_BLOCKED: "PLATFORM_TOKEN_TENANT_API_BLOCKED",
  TENANT_TOKEN_PLATFORM_API_BLOCKED: "TENANT_TOKEN_PLATFORM_API_BLOCKED"
});

const logSecurityEvent = (event, req = null, meta = {}) => {
  const payload = {
    event,
    ...(req ? logger.buildRequestLogFields(req) : {}),
    ...meta
  };

  if (
    event === SECURITY_EVENTS.AUTH_LOGIN_FAILED ||
    event === SECURITY_EVENTS.PLATFORM_LOGIN_FAILED
  ) {
    recordAuthFailure(event);
  }
  if (event === SECURITY_EVENTS.AUTH_RATE_LIMITED) {
    recordRateLimited(meta.kind || "auth");
  }

  logger.warn("security_event", payload);
};

module.exports = {
  SECURITY_EVENTS,
  logSecurityEvent
};
