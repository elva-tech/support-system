const {
  ALL_TENANT_STATUSES,
  RESERVED_TENANT_SLUGS,
  TENANT_SLUG_PATTERN
} = require("../../shared/constants/tenant");
const {
  invalidTenantName,
  invalidTenantSlug,
  reservedTenantSlug,
  invalidTenantStatus
} = require("./tenant.errors");

/**
 * Normalize a slug candidate: trim + lowercase.
 * Does not validate format — call assertValidTenantSlug / validateTenantSlug after.
 */
const normalizeTenantSlug = (slug) => {
  if (slug === undefined || slug === null) {
    return "";
  }
  return String(slug).trim().toLowerCase();
};

const isReservedTenantSlug = (slug) => {
  const normalized = normalizeTenantSlug(slug);
  return RESERVED_TENANT_SLUGS.includes(normalized);
};

/**
 * Returns { valid: true, slug } or { valid: false, reason, code }.
 * Always normalizes to lowercase before checking.
 */
const validateTenantSlug = (rawSlug) => {
  const slug = normalizeTenantSlug(rawSlug);

  if (!slug) {
    return {
      valid: false,
      reason: "Tenant slug is required",
      code: "INVALID_TENANT_SLUG"
    };
  }

  if (isReservedTenantSlug(slug)) {
    return {
      valid: false,
      reason: `Tenant slug is reserved: ${slug}`,
      code: "RESERVED_TENANT_SLUG"
    };
  }

  if (!TENANT_SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      reason:
        "Tenant slug must be lowercase alphanumeric with optional hyphens (e.g. elva, abc-software)",
      code: "INVALID_TENANT_SLUG"
    };
  }

  return { valid: true, slug };
};

const assertValidTenantSlug = (rawSlug) => {
  const result = validateTenantSlug(rawSlug);
  if (result.valid) {
    return result.slug;
  }
  if (result.code === "RESERVED_TENANT_SLUG") {
    throw reservedTenantSlug(normalizeTenantSlug(rawSlug));
  }
  throw invalidTenantSlug(result.reason);
};

const validateTenantName = (rawName) => {
  const name = rawName === undefined || rawName === null ? "" : String(rawName).trim();
  if (!name) {
    return { valid: false, reason: "Tenant name is required" };
  }
  if (name.length > 200) {
    return { valid: false, reason: "Tenant name must be at most 200 characters" };
  }
  return { valid: true, name };
};

const assertValidTenantName = (rawName) => {
  const result = validateTenantName(rawName);
  if (!result.valid) {
    throw invalidTenantName(result.reason);
  }
  return result.name;
};

const assertValidTenantStatus = (status) => {
  if (!ALL_TENANT_STATUSES.includes(status)) {
    throw invalidTenantStatus(status);
  }
  return status;
};

module.exports = {
  normalizeTenantSlug,
  isReservedTenantSlug,
  validateTenantSlug,
  assertValidTenantSlug,
  validateTenantName,
  assertValidTenantName,
  assertValidTenantStatus
};
