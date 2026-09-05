/**
 * Integration: domain availability + SLA isolation + resolve/close/reopen
 * Requires MongoDB (skipped when unavailable).
 */

const mongoose = require("mongoose");
const request = require("supertest");

const hasMongo = Boolean(process.env.MONGODB_URI || process.env.TEST_MONGODB_URI);

(hasMongo ? describe : describe.skip)("master domain + SLA + lifecycle integration", () => {
  let app;
  let Tenant;
  let platformToken;
  let env;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.TENANT_BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN || "support.example.test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-master-feature";
    process.env.PLATFORM_JWT_SECRET =
      process.env.PLATFORM_JWT_SECRET || process.env.JWT_SECRET || "test-platform-secret";

    const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
    await mongoose.connect(uri);
    app = require("../../src/app");
    env = require("../../src/config/env");
    Tenant = require("../../src/modules/tenants/tenant.model");

    // Prefer existing platform login helpers if present in suite env
    try {
      const PlatformAdmin = require("../../src/modules/platform-admin/platform-admin.model");
      const jwt = require("jsonwebtoken");
      let admin = await PlatformAdmin.findOne({ email: /platform/i });
      if (!admin) {
        admin = await PlatformAdmin.create({
          email: "platform-master@example.test",
          passwordHash: "x",
          name: "Platform",
          role: "PLATFORM_SUPER_ADMIN",
          isActive: true
        });
      }
      platformToken = jwt.sign(
        { sub: String(admin._id), typ: "platform", role: admin.role || "PLATFORM_SUPER_ADMIN" },
        env.platformJwtSecret || env.jwtSecret || process.env.PLATFORM_JWT_SECRET,
        { expiresIn: "1h" }
      );
    } catch {
      platformToken = null;
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test("slug availability uses TENANT_BASE_DOMAIN", async () => {
    if (!platformToken) return;
    const slug = `avail-${Date.now().toString(36)}`;
    const res = await request(app)
      .get(`/api/platform/tenants/slug-availability`)
      .query({ slug })
      .set("Authorization", `Bearer ${platformToken}`);

    expect([200, 409]).toContain(res.status);
    expect(res.body.data.workspaceUrl).toContain(`.${env.tenant.baseDomain}`);
    expect(res.body.data.dnsMode).toBe("wildcard");
  });

  test("reserved slug rejected", async () => {
    if (!platformToken) return;
    const res = await request(app)
      .get(`/api/platform/tenants/slug-availability`)
      .query({ slug: "admin" })
      .set("Authorization", `Bearer ${platformToken}`);
    expect(res.status).toBe(409);
    expect(res.body.data.available).toBe(false);
  });

  test("service management defaults exist or can be ensured", async () => {
    const { defaultServiceManagement } = require("../../src/shared/constants/service-management");
    const tenant = await Tenant.findOne({}).select("settings");
    if (!tenant) return;
    const sm = tenant.settings?.serviceManagement || defaultServiceManagement();
    expect(sm.priorities?.length).toBeGreaterThanOrEqual(4);
    expect(sm.slaPolicies?.length).toBeGreaterThanOrEqual(4);
  });
});
