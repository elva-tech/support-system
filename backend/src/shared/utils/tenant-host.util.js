const {
  RESERVED_TENANT_SLUGS,
  TENANT_SLUG_PATTERN
} = require("../constants/tenant");

/**
 * Extract request hostname for tenant resolution (Phase 13).
 *
 * When trustProxy is enabled, prefer Express `req.hostname` (honors X-Forwarded-Host
 * only after Express trust proxy is configured).
 * When trustProxy is disabled, use the Host header only — never raw X-Forwarded-Host.
 */
const extractHostname = (req, { trustProxy = false } = {}) => {
  let raw = "";

  if (trustProxy && req && typeof req.hostname === "string" && req.hostname) {
    raw = req.hostname;
  } else if (trustProxy) {
    // Fallback if Express hostname unavailable (unit tests)
    const forwarded = req?.headers?.["x-forwarded-host"];
    raw = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req?.headers?.host || "";
  } else {
    raw = req?.headers?.host || "";
  }

  const host = String(raw).split(",")[0].trim().toLowerCase();
  if (!host) {
    return "";
  }

  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(0, end + 1) : host;
  }
  return host.replace(/:\d+$/, "");
};

/**
 * Classify hostname under TENANT_BASE_DOMAIN.
 *
 * kinds:
 * - tenant   → {slug}.baseDomain (operable tenant candidate)
 * - platform → admin.baseDomain
 * - reserved → other infrastructure subdomains (api, www, …)
 * - apex     → bare baseDomain
 * - local    → localhost / loopback
 * - external → unrelated host
 * - invalid  → multi-level subdomain or bad slug format
 * - none     → empty
 */
const parseTenantSlugFromHostname = (hostname, baseDomain) => {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  const apex = String(baseDomain || "")
    .trim()
    .toLowerCase();

  if (!host) {
    return { kind: "none", slug: null };
  }

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  ) {
    return { kind: "local", slug: null };
  }

  if (!apex) {
    return { kind: "none", slug: null };
  }

  if (host === apex) {
    return { kind: "apex", slug: null };
  }

  const suffix = `.${apex}`;
  if (!host.endsWith(suffix)) {
    return { kind: "external", slug: null };
  }

  const subdomain = host.slice(0, -suffix.length);
  // Multi-level (foo.bar.base) is intentionally unsupported
  if (!subdomain || subdomain.includes(".")) {
    return { kind: "invalid", slug: null };
  }

  if (subdomain === "admin") {
    return { kind: "platform", slug: "admin" };
  }

  if (RESERVED_TENANT_SLUGS.includes(subdomain)) {
    return { kind: "reserved", slug: subdomain };
  }

  if (!TENANT_SLUG_PATTERN.test(subdomain)) {
    return { kind: "invalid", slug: null };
  }

  return { kind: "tenant", slug: subdomain };
};

/**
 * Hostname from browser Origin header (Phase 13 Option B API host support).
 * Returns null when Origin is missing or unparsable.
 */
const extractHostnameFromOrigin = (originHeader) => {
  if (!originHeader || typeof originHeader !== "string") {
    return null;
  }
  try {
    const url = new URL(originHeader);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return String(url.hostname || "")
      .trim()
      .toLowerCase();
  } catch {
    return null;
  }
};

module.exports = {
  extractHostname,
  extractHostnameFromOrigin,
  parseTenantSlugFromHostname
};
