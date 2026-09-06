const env = require("../../config/env");
const Tenant = require("./tenant.model");
const {
  OPERABLE_TENANT_STATUSES,
  TENANT_ERROR_CODES
} = require("../../shared/constants/tenant");
const {
  tenantNotFound,
  tenantError
} = require("./tenant.errors");
const {
  extractHostname,
  extractHostnameFromOrigin,
  parseTenantSlugFromHostname
} = require("../../shared/utils/tenant-host.util");
const { normalizeTenantSlug } = require("./tenant.validation");

const TENANT_HEADER = "x-tenant-slug";

const toTenantContext = (tenant) => ({
  _id: tenant._id,
  name: tenant.name,
  slug: tenant.slug,
  status: tenant.status
});

const assertTenantOperable = (tenant) => {
  if (!OPERABLE_TENANT_STATUSES.includes(tenant.status)) {
    throw tenantError(
      403,
      TENANT_ERROR_CODES.TENANT_INACTIVE,
      "This workspace is not available"
    );
  }
};

const loadTenantBySlug = async (rawSlug, { requireOperable = true } = {}) => {
  const slug = normalizeTenantSlug(rawSlug);
  if (!slug) {
    throw tenantNotFound();
  }

  const tenant = await Tenant.findOne({ slug }).select("_id name slug status");
  if (!tenant) {
    throw tenantNotFound();
  }

  if (requireOperable) {
    assertTenantOperable(tenant);
  }

  return toTenantContext(tenant);
};

/**
 * Resolve tenant slug candidate from request (does not load DB).
 * Priority:
 * 1. X-Tenant-Slug when header override enabled (dev/test only — never in production)
 * 2. Hostname subdomain under TENANT_BASE_DOMAIN (Option A / portal Host)
 * 3. Browser Origin hostname when Host is API/reserved/external (Option B)
 * 4. TENANT_DEV_DEFAULT_SLUG (non-production only)
 *
 * Production: X-Tenant-Slug is rejected when present; never honored.
 * Origin never overrides a concrete tenant Host.
 */
const resolveTenantSlugCandidate = (req) => {
  const headerRaw = req.headers[TENANT_HEADER];
  const headerSlug = headerRaw ? normalizeTenantSlug(headerRaw) : "";

  if (env.isProduction) {
    if (headerSlug && env.tenant.rejectHeaderInProduction) {
      throw tenantError(
        403,
        TENANT_ERROR_CODES.TENANT_OVERRIDE_FORBIDDEN,
        "Tenant override header is not allowed"
      );
    }
  } else if (env.tenant.headerOverrideEnabled && headerSlug) {
    return { source: "header", slug: headerSlug };
  }

  const trustProxy = Boolean(env.trustProxy);
  const hostname = extractHostname(req, { trustProxy });
  const parsed = parseTenantSlugFromHostname(hostname, env.tenant.baseDomain);

  if (parsed.kind === "tenant" && parsed.slug) {
    return { source: "hostname", slug: parsed.slug };
  }

  // Option B: dedicated API host (api.* / external) — use browser Origin when it is a tenant portal
  if (["reserved", "platform", "central-support", "external", "apex"].includes(parsed.kind)) {
    const originHost = extractHostnameFromOrigin(req.headers.origin);
    if (originHost) {
      const originParsed = parseTenantSlugFromHostname(originHost, env.tenant.baseDomain);
      if (originParsed.kind === "tenant" && originParsed.slug) {
        return { source: "origin", slug: originParsed.slug };
      }
    }
  }

  if (parsed.kind === "platform" || parsed.kind === "central-support" || parsed.kind === "reserved") {
    throw tenantError(
      400,
      TENANT_ERROR_CODES.INVALID_TENANT_HOST,
      "This host is reserved for platform services"
    );
  }

  if (parsed.kind === "invalid") {
    throw tenantError(
      400,
      TENANT_ERROR_CODES.INVALID_TENANT_HOST,
      "Invalid tenant host"
    );
  }

  if (!env.isProduction && env.tenant.devDefaultSlug) {
    return { source: "dev_default", slug: env.tenant.devDefaultSlug };
  }

  return { source: "none", slug: null };
};

/**
 * Full resolution: slug candidate → Tenant document → operable context.
 * Returns null when no tenant applies (optional middleware).
 * Throws on invalid/reserved/inactive when a candidate exists.
 */
const resolveTenantFromRequest = async (req, { required = false } = {}) => {
  const candidate = resolveTenantSlugCandidate(req);

  if (!candidate.slug) {
    if (required) {
      throw tenantError(
        400,
        TENANT_ERROR_CODES.TENANT_CONTEXT_REQUIRED,
        "Tenant context is required"
      );
    }
    return null;
  }

  const tenant = await loadTenantBySlug(candidate.slug, { requireOperable: true });
  return { ...tenant, resolutionSource: candidate.source };
};

const idsEqual = (a, b) => {
  if (!a || !b) return false;
  return a.toString() === b.toString();
};

module.exports = {
  TENANT_HEADER,
  toTenantContext,
  assertTenantOperable,
  loadTenantBySlug,
  resolveTenantSlugCandidate,
  resolveTenantFromRequest,
  idsEqual
};
