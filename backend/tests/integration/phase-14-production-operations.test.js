const request = require("supertest");
const app = require("../../src/app");
const {
  normalizeIncomingRequestId,
  generateRequestId
} = require("../../src/shared/middleware/request-id.middleware");
const { redactObject } = require("../../src/shared/utils/log-redaction.util");
const logger = require("../../src/shared/utils/logger");
const { snapshot, reset: resetMetrics } = require("../../src/shared/observability/metrics");
const { getLiveness, getReadiness } = require("../../src/shared/health/health.service");
const { getAppVersionMeta } = require("../../src/shared/observability/app-version");
const ApiError = require("../../src/shared/utils/ApiError");
const errorHandler = require("../../src/shared/middleware/error.middleware");
const Tenant = require("../../src/modules/tenants/tenant.model");
const User = require("../../src/modules/users/user.model");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { ROLES } = require("../../src/shared/constants/roles");
const { loginAgent } = require("../helpers/seed");
const { loginLimiter } = require("../../src/shared/middleware/rate-limit.middleware");
const env = require("../../src/config/env");

describe("Phase 14 production operations", () => {
  beforeEach(() => {
    logger.clear();
    resetMetrics();
  });

  describe("request correlation", () => {
    test("generates X-Request-ID when missing", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.headers["x-request-id"]).toMatch(/^[a-f0-9]{32}$/);
    });

    test("accepts valid incoming request ID", async () => {
      const id = "client-req-abc12345";
      const res = await request(app).get("/health").set("X-Request-ID", id);
      expect(res.headers["x-request-id"]).toBe(id);
    });

    test("rejects invalid request ID and replaces", async () => {
      expect(normalizeIncomingRequestId("bad id with spaces!!!")).toBeNull();
      expect(normalizeIncomingRequestId("ok-id_12345")).toBe("ok-id_12345");
      expect(generateRequestId()).toMatch(/^[a-f0-9]{32}$/);

      const res = await request(app).get("/health").set("X-Request-ID", "no spaces allowed!!!");
      expect(res.headers["x-request-id"]).toMatch(/^[a-f0-9]{32}$/);
      expect(res.headers["x-request-id"]).not.toBe("no spaces allowed!!!");
    });
  });

  describe("error handling", () => {
    test("unexpected error returns safe response with requestId and no stack", () => {
      const req = { requestId: "req-test-0001", method: "GET", originalUrl: "/api/test" };
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
        getHeader() {
          return undefined;
        }
      };

      errorHandler(new Error("boom secret stack"), req, res, () => {});

      expect(res.statusCode).toBe(500);
      expect(res.body.requestId).toBe("req-test-0001");
      expect(res.body.message).toMatch(/unexpected/i);
      expect(JSON.stringify(res.body)).not.toMatch(/boom secret stack/);
      expect(res.body.error?.code).toBe("INTERNAL_ERROR");
      expect(res.body.error?.requestId).toBe("req-test-0001");
    });

    test("operational ApiError preserves message and includes requestId", () => {
      const req = { requestId: "req-op-1", method: "POST", originalUrl: "/api/auth/login" };
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
        getHeader() {
          return undefined;
        }
      };

      errorHandler(new ApiError(401, "Invalid email or password"), req, res, () => {});
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
      expect(res.body.requestId).toBe("req-op-1");
    });
  });

  describe("log redaction", () => {
    test("redacts nested sensitive fields", () => {
      const redacted = redactObject({
        password: "secret",
        nested: {
          accessToken: "jwt-here",
          otp: "123456",
          authorization: "Bearer x",
          safe: "ok"
        },
        cookie: "sid=1"
      });

      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.nested.accessToken).toBe("[REDACTED]");
      expect(redacted.nested.otp).toBe("[REDACTED]");
      expect(redacted.nested.authorization).toBe("[REDACTED]");
      expect(redacted.nested.safe).toBe("ok");
      expect(redacted.cookie).toBe("[REDACTED]");
    });
  });

  describe("health / version", () => {
    test("liveness remains minimal; readiness reflects DB", async () => {
      expect(getLiveness()).toEqual({ status: "ok" });
      const ready = await getReadiness();
      expect(ready.status).toBe("ready");

      const live = await request(app).get("/health");
      expect(live.status).toBe(200);
      expect(live.body).toEqual({ status: "ok" });
    });

    test("app version meta falls back gracefully", () => {
      const meta = getAppVersionMeta();
      expect(meta.version).toBeTruthy();
    });
  });

  describe("metrics foundation", () => {
    test("access logging records low-cardinality http metrics", async () => {
      await request(app).get("/health");
      const snap = snapshot();
      expect(Object.keys(snap.counters).some((k) => k.startsWith("http_requests_total"))).toBe(true);
    });
  });

  describe("security observability", () => {
    test("production tenant header override returns forbidden with requestId", async () => {
      const originalProd = env.isProduction;
      const originalReject = env.tenant.rejectHeaderInProduction;
      env.isProduction = true;
      env.tenant.rejectHeaderInProduction = true;

      try {
        const res = await request(app)
          .get("/api/workspace/branding/public")
          .set("Host", "elva.elvasupport.in")
          .set("X-Tenant-Slug", "evil");
        expect(res.status).toBe(403);
        expect(res.body.requestId || res.headers["x-request-id"]).toBeTruthy();
      } finally {
        env.isProduction = originalProd;
        env.tenant.rejectHeaderInProduction = originalReject;
      }
    });

    test("cross-tenant membership mismatch returns access denied with requestId", async () => {
      const a = await Tenant.create({
        name: "Tenant A",
        slug: "tenanta14",
        status: TENANT_STATUSES.ACTIVE,
        settings: { organization: {}, branding: {}, support: {}, notifications: {} }
      });
      await Tenant.create({
        name: "Tenant B",
        slug: "tenantb14",
        status: TENANT_STATUSES.ACTIVE,
        settings: { organization: {}, branding: {}, support: {}, notifications: {} }
      });
      await User.create({
        tenantId: a._id,
        email: "admin@tenanta14.test",
        password: "Admin@12345",
        firstName: "A",
        lastName: "Admin",
        role: ROLES.ADMIN,
        isActive: true
      });

      const token = await loginAgent(app, "admin@tenanta14.test", "Admin@12345", {
        tenantSlug: "tenanta14"
      });

      const res = await request(app)
        .get("/api/workspace/settings")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Tenant-Slug", "tenantb14")
        .set("Host", "tenantb14.elvasupport.in");

      expect(res.status).toBe(403);
      expect(res.body.requestId).toBeTruthy();
      expect(res.headers["x-request-id"]).toBeTruthy();
    });
  });

  describe("rate limiting", () => {
    test("repeated tenant login attempts are limited", async () => {
      await Tenant.create({
        name: "Rate Limit Co",
        slug: "ratelimitco",
        status: TENANT_STATUSES.ACTIVE,
        settings: { organization: {}, branding: {}, support: {}, notifications: {} }
      });

      // Reset shared in-memory limiter so other tests are not affected.
      if (typeof loginLimiter.resetKey === "function") {
        await loginLimiter.resetKey("::ffff:127.0.0.1");
        await loginLimiter.resetKey("127.0.0.1");
      }

      const prevMax = process.env.RATE_LIMIT_LOGIN_MAX;
      // Limiter already constructed with max=100 from setup — hit until 429
      let limited = false;
      for (let i = 0; i < 110; i += 1) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Tenant-Slug", "ratelimitco")
          .set("Host", "ratelimitco.elvasupport.in")
          .send({ email: "nobody@ratelimit.test", password: "wrong-password" });
        if (res.status === 429) {
          limited = true;
          expect(res.headers["x-request-id"]).toBeTruthy();
          break;
        }
      }
      expect(limited).toBe(true);

      if (typeof loginLimiter.resetKey === "function") {
        await loginLimiter.resetKey("::ffff:127.0.0.1");
        await loginLimiter.resetKey("127.0.0.1");
      }
      process.env.RATE_LIMIT_LOGIN_MAX = prevMax;
    });
  });
});
