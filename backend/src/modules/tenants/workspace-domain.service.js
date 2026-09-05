/**
 * Workspace / tenant domain helpers (env-driven).
 * Hostname = {slug}.{TENANT_BASE_DOMAIN} — no per-tenant DNS records.
 */

const env = require("../../config/env");
const Tenant = require("./tenant.model");
const {
  validateTenantSlug,
  normalizeTenantSlug,
  isReservedTenantSlug
} = require("./tenant.validation");
const { parseTenantSlugFromHostname } = require("../../shared/utils/tenant-host.util");

const getBaseDomain = () =>
  String(env.tenant.baseDomain || "").toLowerCase().trim();

const getPlatformAdminHost = () =>
  String(env.tenant.platformAdminHost || `admin.${getBaseDomain()}`)
    .toLowerCase()
    .trim();

const getWorkspaceProtocol = () =>
  String(env.tenantProvisioning.workspaceProtocol || "https").toLowerCase().trim();

const buildWorkspaceHost = (slug) => {
  const normalized = normalizeTenantSlug(slug);
  return `${normalized}.${getBaseDomain()}`;
};

const buildWorkspaceUrl = (slug) => {
  const protocol = getWorkspaceProtocol();
  return `${protocol}://${buildWorkspaceHost(slug)}`;
};

const buildInvitationUrl = (slug, rawToken) => {
  const workspaceUrl = buildWorkspaceUrl(slug);
  const path = env.tenantProvisioning.onboardingPath.startsWith("/")
    ? env.tenantProvisioning.onboardingPath
    : `/${env.tenantProvisioning.onboardingPath}`;
  return `${workspaceUrl}${path}?token=${encodeURIComponent(rawToken)}`;
};

/**
 * Validate slug + hostname readiness (application-level).
 * Does not probe live DNS — wildcard infrastructure is an ops concern.
 */
const checkWorkspaceAvailability = async (rawSlug) => {
  const checks = [];
  const slugResult = validateTenantSlug(rawSlug);

  if (!slugResult.valid) {
    checks.push({
      key: "slug_format",
      ok: false,
      message: slugResult.reason,
      code: slugResult.code
    });
    return {
      available: false,
      slug: normalizeTenantSlug(rawSlug) || null,
      workspaceHost: null,
      workspaceUrl: null,
      dnsMode: "wildcard",
      checks,
      message: slugResult.reason,
      code: slugResult.code
    };
  }

  const slug = slugResult.slug;
  checks.push({ key: "slug_format", ok: true, message: "Slug format valid" });

  if (isReservedTenantSlug(slug)) {
    checks.push({
      key: "reserved",
      ok: false,
      message: `Reserved workspace hostname: ${slug}`,
      code: "RESERVED_TENANT_SLUG"
    });
    return {
      available: false,
      slug,
      workspaceHost: buildWorkspaceHost(slug),
      workspaceUrl: buildWorkspaceUrl(slug),
      dnsMode: "wildcard",
      checks,
      message: `Reserved workspace hostname: ${slug}`,
      code: "RESERVED_TENANT_SLUG"
    };
  }
  checks.push({ key: "reserved", ok: true, message: "Hostname is not reserved" });

  const host = buildWorkspaceHost(slug);
  const parsed = parseTenantSlugFromHostname(host, getBaseDomain());
  if (parsed.kind !== "tenant" || parsed.slug !== slug) {
    checks.push({
      key: "hostname",
      ok: false,
      message: "Generated hostname is not a valid tenant host",
      code: "INVALID_TENANT_HOST"
    });
    return {
      available: false,
      slug,
      workspaceHost: host,
      workspaceUrl: buildWorkspaceUrl(slug),
      dnsMode: "wildcard",
      checks,
      message: "Generated hostname is not a valid tenant host",
      code: "INVALID_TENANT_HOST"
    };
  }
  checks.push({ key: "hostname", ok: true, message: "Workspace hostname structure valid" });

  const existing = await Tenant.findOne({ slug }).select("_id name slug").lean();
  if (existing) {
    checks.push({
      key: "unique",
      ok: false,
      message: "Slug already belongs to an existing business",
      code: "TENANT_SLUG_ALREADY_EXISTS"
    });
    return {
      available: false,
      slug,
      workspaceHost: host,
      workspaceUrl: buildWorkspaceUrl(slug),
      dnsMode: "wildcard",
      checks,
      message: "Slug already belongs to an existing business",
      code: "TENANT_SLUG_ALREADY_EXISTS"
    };
  }
  checks.push({ key: "unique", ok: true, message: "Tenant slug available" });
  checks.push({
    key: "wildcard_dns",
    ok: true,
    message: "Wildcard workspace DNS configuration expected (*.{baseDomain})".replace(
      "{baseDomain}",
      getBaseDomain()
    )
  });

  return {
    available: true,
    slug,
    workspaceHost: host,
    workspaceUrl: buildWorkspaceUrl(slug),
    dnsMode: "wildcard",
    baseDomain: getBaseDomain(),
    platformAdminHost: getPlatformAdminHost(),
    checks,
    message: "Workspace hostname available",
    code: null
  };
};

module.exports = {
  getBaseDomain,
  getPlatformAdminHost,
  getWorkspaceProtocol,
  buildWorkspaceHost,
  buildWorkspaceUrl,
  buildInvitationUrl,
  checkWorkspaceAvailability
};
