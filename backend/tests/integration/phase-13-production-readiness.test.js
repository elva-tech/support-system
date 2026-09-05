const request = require("supertest");
const app = require("../../src/app");
const Tenant = require("../../src/modules/tenants/tenant.model");
const { TENANT_STATUSES, TENANT_ERROR_CODES } = require("../../src/shared/constants/tenant");
const {
  resolveTenantSlugCandidate,
  resolveTenantFromRequest
} = require("../../src/modules/tenants/tenant-resolver.service");

describe("Phase 13 production readiness (integration)", () => {
  test("health liveness is dependency-light; readiness reflects DB", async () => {
    const live = await request(app).get("/health");
    expect(live.status).toBe(200);
    expect(live.body).toEqual({ status: "ok" });

    const ready = await request(app).get("/health/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe("ready");
  });

  test("production header override is rejected and never honored", async () => {
    const env = require("../../src/config/env");
    const originalProd = env.isProduction;
    const originalReject = env.tenant.rejectHeaderInProduction;
    const originalDevSlug = env.tenant.devDefaultSlug;

    env.isProduction = true;
    env.tenant.rejectHeaderInProduction = true;
    env.tenant.devDefaultSlug = "elva";

    try {
      expect(() =>
        resolveTenantSlugCandidate({
          headers: {
            "x-tenant-slug": "elva",
            host: "acme.elvasupport.in"
          }
        })
      ).toThrow(/not allowed/i);

      // Without header, hostname wins — no silent fall back to elva
      const candidate = resolveTenantSlugCandidate({
        headers: { host: "acme.elvasupport.in" }
      });
      expect(candidate).toEqual({ source: "hostname", slug: "acme" });
    } finally {
      env.isProduction = originalProd;
      env.tenant.rejectHeaderInProduction = originalReject;
      env.tenant.devDefaultSlug = originalDevSlug;
    }
  });

  test("unknown tenant host fails with tenant-not-found (no ELVA fallback)", async () => {
    const env = require("../../src/config/env");
    const originalProd = env.isProduction;
    const originalDevSlug = env.tenant.devDefaultSlug;
    env.isProduction = true;
    env.tenant.devDefaultSlug = "";

    try {
      await expect(
        resolveTenantFromRequest(
          { headers: { host: "unknown.elvasupport.in" } },
          { required: true }
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        errors: { code: TENANT_ERROR_CODES.TENANT_NOT_FOUND }
      });
    } finally {
      env.isProduction = originalProd;
      env.tenant.devDefaultSlug = originalDevSlug;
    }
  });

  test("reserved/platform hosts rejected for tenant APIs", async () => {
    expect(() =>
      resolveTenantSlugCandidate({ headers: { host: "admin.elvasupport.in" } })
    ).toThrow(/reserved/i);
    expect(() =>
      resolveTenantSlugCandidate({ headers: { host: "api.elvasupport.in" } })
    ).toThrow(/reserved/i);
  });

  test("known tenant resolves from hostname", async () => {
    await Tenant.create({
      name: "Acme Co",
      slug: "acme",
      status: TENANT_STATUSES.ACTIVE
    });

    const resolved = await resolveTenantFromRequest(
      { headers: { host: "acme.elvasupport.in" } },
      { required: true }
    );
    expect(resolved.slug).toBe("acme");
    expect(resolved.resolutionSource).toBe("hostname");
  });

  test("Option B: Origin resolves tenant when Host is API reserved", async () => {
    await Tenant.create({
      name: "Origin Co",
      slug: "origin-co",
      status: TENANT_STATUSES.ACTIVE
    });

    const resolved = await resolveTenantFromRequest(
      {
        headers: {
          host: "api.elvasupport.in",
          origin: "https://origin-co.elvasupport.in"
        }
      },
      { required: true }
    );
    expect(resolved.slug).toBe("origin-co");
    expect(resolved.resolutionSource).toBe("origin");
  });

  test("Origin cannot override a concrete tenant Host", async () => {
    await Tenant.create({
      name: "Host Wins",
      slug: "host-wins",
      status: TENANT_STATUSES.ACTIVE
    });

    const candidate = resolveTenantSlugCandidate({
      headers: {
        host: "host-wins.elvasupport.in",
        origin: "https://other.elvasupport.in"
      }
    });
    expect(candidate).toEqual({ source: "hostname", slug: "host-wins" });
  });

  test("environment validation rejects unsafe production header override", () => {
    const { validateEnvironment } = require("../../src/config/validate-env");
    const keys = [
      "NODE_ENV",
      "MONGODB_URI",
      "JWT_SECRET",
      "INTERNAL_API_KEY",
      "TENANT_BASE_DOMAIN",
      "CORS_ALLOWED_ORIGINS",
      "CORS_ORIGIN",
      "FRONTEND_URL",
      "NOTIFICATION_PROVIDER",
      "RESEND_API_KEY",
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASS",
      "NOTIFICATION_FALLBACK_ENABLED",
      "TENANT_HEADER_OVERRIDE_ENABLED",
      "TENANT_DEV_DEFAULT_SLUG",
      "EXPOSE_OTP_IN_RESPONSE"
    ];
    const snapshot = {};
    for (const key of keys) {
      snapshot[key] = process.env[key];
    }

    process.env.NODE_ENV = "production";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/elva-support-prod-check";
    process.env.JWT_SECRET = "prod-secret-not-the-dev-default-value-123456";
    process.env.INTERNAL_API_KEY = "prod-internal-key-not-dev-default-123456";
    process.env.TENANT_BASE_DOMAIN = "elvasupport.in";
    process.env.CORS_ALLOWED_ORIGINS = "https://admin.elvasupport.in";
    delete process.env.CORS_ORIGIN;
    process.env.FRONTEND_URL = "https://admin.elvasupport.in";
    process.env.NOTIFICATION_PROVIDER = "SMTP";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "smtp-pass-value";
    delete process.env.RESEND_API_KEY;
    process.env.NOTIFICATION_FALLBACK_ENABLED = "false";
    process.env.EXPOSE_OTP_IN_RESPONSE = "false";
    process.env.TENANT_HEADER_OVERRIDE_ENABLED = "true";
    delete process.env.TENANT_DEV_DEFAULT_SLUG;

    try {
      expect(() => validateEnvironment()).toThrow(/TENANT_HEADER_OVERRIDE_ENABLED/);
    } finally {
      for (const key of [...keys, "EXPOSE_OTP_IN_RESPONSE"]) {
        if (snapshot[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = snapshot[key];
        }
      }
    }
  });
});
