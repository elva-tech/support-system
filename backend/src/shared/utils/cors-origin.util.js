/**
 * Production-safe CORS origin matching (Phase 13).
 *
 * Allows:
 * - Exact entries from CORS_ORIGIN / CORS_ALLOWED_ORIGINS
 * - https://admin.{baseDomain} (platform)
 * - https://{single-label-slug}.{baseDomain} when tenant subdomains enabled
 *
 * Rejects:
 * - https://evil-elvasupport.in
 * - https://elvasupport.in.attacker.com
 * - Multi-level subdomains (foo.bar.base)
 * - Arbitrary * wildcards
 */

const { TENANT_SLUG_PATTERN, RESERVED_TENANT_SLUGS } = require("../constants/tenant");

const parseOriginList = (value) => {
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const normalizeBaseDomain = (baseDomain) =>
  String(baseDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");

/**
 * Parse a browser Origin header into { protocol, host } or null.
 */
const parseOrigin = (origin) => {
  if (!origin || typeof origin !== "string") {
    return null;
  }
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (!host) {
      return null;
    }
    return {
      protocol: url.protocol.replace(":", ""),
      host,
      origin: `${url.protocol}//${url.host}`
    };
  } catch {
    return null;
  }
};

const isLocalDevOrigin = (parsed) => {
  if (!parsed) {
    return false;
  }
  return (
    parsed.host === "localhost" ||
    parsed.host === "127.0.0.1" ||
    parsed.host === "[::1]" ||
    parsed.host.endsWith(".localhost")
  );
};

/**
 * Safe tenant / platform subdomain match under apex base domain.
 * Only a single DNS label is allowed: {slug}.{baseDomain}
 */
const matchesTenantSubdomainOrigin = (parsed, baseDomain, { allowReserved = false } = {}) => {
  const apex = normalizeBaseDomain(baseDomain);
  if (!parsed || !apex) {
    return false;
  }

  // Require HTTPS in production-style subdomain matching (callers may relax for local)
  if (parsed.protocol !== "https" && parsed.protocol !== "http") {
    return false;
  }

  if (parsed.host === apex) {
    return false;
  }

  const suffix = `.${apex}`;
  if (!parsed.host.endsWith(suffix)) {
    return false;
  }

  const subdomain = parsed.host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes(".")) {
    return false;
  }

  if (!TENANT_SLUG_PATTERN.test(subdomain)) {
    return false;
  }

  if (!allowReserved && RESERVED_TENANT_SLUGS.includes(subdomain)) {
    // Platform admin is allowed separately
    if (subdomain === "admin") {
      return true;
    }
    return false;
  }

  return true;
};

/**
 * @param {string|undefined} origin
 * @param {object} options
 * @param {string[]} options.exactOrigins
 * @param {string} options.baseDomain
 * @param {boolean} options.allowTenantSubdomains
 * @param {boolean} options.allowLocalhost
 * @param {boolean} options.allowVercelPreviews
 * @param {boolean} options.requireHttpsForSubdomains
 */
const isAllowedCorsOrigin = (origin, options = {}) => {
  // Non-browser / same-origin style requests
  if (!origin) {
    return true;
  }

  const {
    exactOrigins = [],
    baseDomain = "elvasupport.in",
    allowTenantSubdomains = false,
    allowLocalhost = false,
    allowVercelPreviews = false,
    requireHttpsForSubdomains = true
  } = options;

  if (exactOrigins.includes(origin)) {
    return true;
  }

  const parsed = parseOrigin(origin);
  if (!parsed) {
    return false;
  }

  if (allowLocalhost && isLocalDevOrigin(parsed)) {
    return true;
  }

  if (allowVercelPreviews && /^https:\/\/[\w-]+\.vercel\.app$/i.test(origin)) {
    return true;
  }

  if (allowTenantSubdomains) {
    if (requireHttpsForSubdomains && parsed.protocol !== "https") {
      // Allow http only for exactOrigins / localhost — not for public tenant hosts
      return false;
    }
    // Public SaaS landing origin (apex / www) — no tenant APIs required, but allow CORS safely
    const apex = normalizeBaseDomain(baseDomain);
    if (apex && (parsed.host === apex || parsed.host === `www.${apex}`)) {
      return true;
    }
    if (matchesTenantSubdomainOrigin(parsed, baseDomain)) {
      return true;
    }
  }

  return false;
};

module.exports = {
  parseOriginList,
  parseOrigin,
  isLocalDevOrigin,
  matchesTenantSubdomainOrigin,
  isAllowedCorsOrigin,
  normalizeBaseDomain
};
