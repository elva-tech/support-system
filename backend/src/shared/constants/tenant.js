/**
 * Tenant domain constants (Phase 2 foundation).
 * Organization-level tenancy — distinct from Application (product) models.
 */

const TENANT_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  TRIAL: "TRIAL",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
  ARCHIVED: "ARCHIVED"
});

const ALL_TENANT_STATUSES = Object.values(TENANT_STATUSES);

/** Default status for newly created tenants. */
const DEFAULT_TENANT_STATUS = TENANT_STATUSES.ACTIVE;

/**
 * Slugs reserved for platform infrastructure / future hostnames.
 * These must never be used as tenant subdomain identifiers.
 */
const RESERVED_TENANT_SLUGS = Object.freeze([
  "admin",
  "www",
  "api",
  "mail",
  "support",
  "app",
  "portal",
  "static",
  "assets"
]);

/**
 * URL-safe slug: lowercase letters, digits, hyphens.
 * Must start and end with alphanumeric; no consecutive hyphens required but single segments OK.
 * Examples valid: elva, abc, abc-software, company123
 * Invalid: Admin, abc_company, abc.company, -elva, elva-
 */
const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Canonical first-tenant seed used by migrations (idempotent by slug). */
const ELVA_TENANT_SEED = Object.freeze({
  name: "ELVA Technologies",
  slug: "elva",
  status: TENANT_STATUSES.ACTIVE
});

const TENANT_ERROR_CODES = Object.freeze({
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  TENANT_SLUG_ALREADY_EXISTS: "TENANT_SLUG_ALREADY_EXISTS",
  INVALID_TENANT_SLUG: "INVALID_TENANT_SLUG",
  RESERVED_TENANT_SLUG: "RESERVED_TENANT_SLUG",
  INVALID_TENANT_STATUS: "INVALID_TENANT_STATUS",
  INVALID_TENANT_NAME: "INVALID_TENANT_NAME"
});

module.exports = {
  TENANT_STATUSES,
  ALL_TENANT_STATUSES,
  DEFAULT_TENANT_STATUS,
  RESERVED_TENANT_SLUGS,
  TENANT_SLUG_PATTERN,
  ELVA_TENANT_SEED,
  TENANT_ERROR_CODES
};
