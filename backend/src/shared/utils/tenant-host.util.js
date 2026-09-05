const {
  RESERVED_TENANT_SLUGS,
  TENANT_SLUG_PATTERN
} = require("../constants/tenant");

/**
 * Extract hostname from Host / X-Forwarded-Host (first value), strip port.
 */
const extractHostname = (req) => {
  const forwarded = req.headers["x-forwarded-host"];
  const raw = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.headers.host || "";
  const host = String(raw).split(",")[0].trim().toLowerCase();
  if (!host) {
    return "";
  }
  // Strip port (also handle IPv6 [::1]:3000 lightly by taking last : only if not ipv6 bracket)
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(0, end + 1) : host;
  }
  return host.replace(/:\d+$/, "");
};

/**
 * Parse tenant slug from hostname given apex base domain.
 *
 * Examples (baseDomain = elvasupport.in):
 *   abc.elvasupport.in → { kind: "tenant", slug: "abc" }
 *   elva.elvasupport.in → { kind: "tenant", slug: "elva" }
 *   admin.elvasupport.in → { kind: "reserved", slug: "admin" }
 *   www.elvasupport.in → { kind: "reserved", slug: "www" }
 *   elvasupport.in → { kind: "apex" }
 *   localhost / 127.0.0.1 / api host → { kind: "local" }
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
    host === "[::1]"
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
    // Unrelated host (e.g. Render API hostname) — not a tenant portal host
    return { kind: "external", slug: null };
  }

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes(".")) {
    // Multi-level or empty → not a simple tenant host
    return { kind: "invalid", slug: null };
  }

  if (RESERVED_TENANT_SLUGS.includes(subdomain)) {
    return { kind: "reserved", slug: subdomain };
  }

  if (!TENANT_SLUG_PATTERN.test(subdomain)) {
    return { kind: "invalid", slug: null };
  }

  return { kind: "tenant", slug: subdomain };
};

module.exports = {
  extractHostname,
  parseTenantSlugFromHostname
};
