/**
 * Phase 13 — production hostname / CORS / header-policy verification.
 * No network access required.
 *
 * Run: npm run verify:production-config
 */

const {
  parseTenantSlugFromHostname,
  extractHostname
} = require("../src/shared/utils/tenant-host.util");
const { isAllowedCorsOrigin } = require("../src/shared/utils/cors-origin.util");

const baseDomain = process.env.TENANT_BASE_DOMAIN || "elvasupport.in";
let failed = 0;

const assert = (label, condition) => {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failed += 1;
  }
};

console.log("Phase 13 production host / CORS verification\n");

console.log("Hostname classification");
assert(
  "admin is platform",
  parseTenantSlugFromHostname(`admin.${baseDomain}`, baseDomain).kind === "platform"
);
assert(
  "elva is tenant",
  parseTenantSlugFromHostname(`elva.${baseDomain}`, baseDomain).kind === "tenant"
);
assert(
  "api is reserved (not tenant)",
  parseTenantSlugFromHostname(`api.${baseDomain}`, baseDomain).kind === "reserved"
);
assert(
  "www is reserved",
  parseTenantSlugFromHostname(`www.${baseDomain}`, baseDomain).kind === "reserved"
);
assert(
  "smtp is reserved",
  parseTenantSlugFromHostname(`smtp.${baseDomain}`, baseDomain).kind === "reserved"
);
assert(
  "multi-level invalid",
  parseTenantSlugFromHostname(`foo.bar.${baseDomain}`, baseDomain).kind === "invalid"
);
assert("localhost is local", parseTenantSlugFromHostname("localhost", baseDomain).kind === "local");

console.log("\nTrust-proxy hostname extraction");
assert(
  "without trustProxy ignores X-Forwarded-Host",
  extractHostname(
    { headers: { host: `elva.${baseDomain}`, "x-forwarded-host": "evil.example.com" } },
    { trustProxy: false }
  ) === `elva.${baseDomain}`
);
assert(
  "with trustProxy uses X-Forwarded-Host",
  extractHostname(
    { headers: { host: "ignored", "x-forwarded-host": `acme.${baseDomain}` } },
    { trustProxy: true }
  ) === `acme.${baseDomain}`
);

console.log("\nCORS matching");
const corsOpts = {
  exactOrigins: [`https://admin.${baseDomain}`],
  baseDomain,
  allowTenantSubdomains: true,
  allowLocalhost: false,
  requireHttpsForSubdomains: true
};
assert(
  "admin origin allowed",
  isAllowedCorsOrigin(`https://admin.${baseDomain}`, corsOpts) === true
);
assert(
  "tenant origin allowed",
  isAllowedCorsOrigin(`https://elva.${baseDomain}`, corsOpts) === true
);
assert(
  "evil lookalike rejected",
  isAllowedCorsOrigin("https://evil-elvasupport.in", corsOpts) === false
);
assert(
  "suffix attack rejected",
  isAllowedCorsOrigin("https://elvasupport.in.attacker.com", corsOpts) === false
);

console.log("\nProduction header override policy (static checks)");
assert(
  "rejectHeaderInProduction default is true unless TENANT_REJECT_HEADER_IN_PRODUCTION=false",
  process.env.TENANT_REJECT_HEADER_IN_PRODUCTION !== "false"
);
assert(
  "TENANT_HEADER_OVERRIDE_ENABLED should not be true in production deploys",
  process.env.NODE_ENV !== "production" || process.env.TENANT_HEADER_OVERRIDE_ENABLED !== "true"
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nAll production config checks passed.");
