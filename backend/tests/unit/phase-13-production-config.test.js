const {
  parseTenantSlugFromHostname,
  extractHostname
} = require("../../src/shared/utils/tenant-host.util");
const { isAllowedCorsOrigin } = require("../../src/shared/utils/cors-origin.util");
const { getLiveness, getReadiness } = require("../../src/shared/health/health.service");
const mongoose = require("mongoose");

describe("Phase 13 hostname resolution", () => {
  const base = "elvasupport.in";

  test("platform and tenant hosts", () => {
    expect(parseTenantSlugFromHostname("admin.elvasupport.in", base)).toEqual({
      kind: "platform",
      slug: "admin"
    });
    expect(parseTenantSlugFromHostname("elva.elvasupport.in", base)).toEqual({
      kind: "tenant",
      slug: "elva"
    });
    expect(parseTenantSlugFromHostname("acme.elvasupport.in", base)).toEqual({
      kind: "tenant",
      slug: "acme"
    });
  });

  test("reserved infrastructure hosts are not tenants", () => {
    expect(parseTenantSlugFromHostname("api.elvasupport.in", base).kind).toBe("reserved");
    expect(parseTenantSlugFromHostname("www.elvasupport.in", base).kind).toBe("reserved");
    expect(parseTenantSlugFromHostname("support.elvasupport.in", base).kind).toBe("central-support");
    expect(parseTenantSlugFromHostname("smtp.elvasupport.in", base).kind).toBe("reserved");
    expect(parseTenantSlugFromHostname("cdn.elvasupport.in", base).kind).toBe("reserved");
  });

  test("multi-level subdomain is invalid", () => {
    expect(parseTenantSlugFromHostname("foo.bar.elvasupport.in", base).kind).toBe("invalid");
  });

  test("localhost and apex", () => {
    expect(parseTenantSlugFromHostname("localhost", base).kind).toBe("local");
    expect(parseTenantSlugFromHostname("elvasupport.in", base).kind).toBe("apex");
  });

  test("extractHostname ignores X-Forwarded-Host when trustProxy is false", () => {
    expect(
      extractHostname(
        {
          headers: {
            "x-forwarded-host": "evil.example.com",
            host: "elva.elvasupport.in:443"
          }
        },
        { trustProxy: false }
      )
    ).toBe("elva.elvasupport.in");
  });

  test("extractHostname may use forwarded host when trustProxy is true", () => {
    expect(
      extractHostname(
        {
          headers: {
            "x-forwarded-host": "abc.elvasupport.in, other.example.com",
            host: "ignored"
          }
        },
        { trustProxy: true }
      )
    ).toBe("abc.elvasupport.in");
  });
});

describe("Phase 13 CORS origin matching", () => {
  const opts = {
    exactOrigins: ["https://admin.elvasupport.in"],
    baseDomain: "elvasupport.in",
    allowTenantSubdomains: true,
    allowLocalhost: false,
    allowVercelPreviews: false,
    requireHttpsForSubdomains: true
  };

  test("allows platform, central support, and tenant origins", () => {
    expect(isAllowedCorsOrigin("https://admin.elvasupport.in", opts)).toBe(true);
    expect(isAllowedCorsOrigin("https://support.elvasupport.in", opts)).toBe(true);
    expect(isAllowedCorsOrigin("https://elva.elvasupport.in", opts)).toBe(true);
    expect(isAllowedCorsOrigin("https://acme.elvasupport.in", opts)).toBe(true);
  });

  test("rejects lookalike and multi-level origins", () => {
    expect(isAllowedCorsOrigin("https://evil-elvasupport.in", opts)).toBe(false);
    expect(isAllowedCorsOrigin("https://elvasupport.in.attacker.com", opts)).toBe(false);
    expect(isAllowedCorsOrigin("https://foo.bar.elvasupport.in", opts)).toBe(false);
    expect(isAllowedCorsOrigin("https://api.elvasupport.in", opts)).toBe(false);
  });

  test("no origin is allowed (non-browser)", () => {
    expect(isAllowedCorsOrigin(undefined, opts)).toBe(true);
  });
});

describe("Phase 13 health endpoints helpers", () => {
  test("liveness is always ok", () => {
    expect(getLiveness()).toEqual({ status: "ok" });
  });

  test("readiness reports ready when mongoose is connected", async () => {
    // Integration suite covers 503 when DB is down; here assert connected test DB path.
    if (mongoose.connection.readyState === 1) {
      const up = await getReadiness();
      expect(up.status).toBe("ready");
    } else {
      const down = await getReadiness();
      expect(down.status).toBe("not_ready");
    }
  });
});
