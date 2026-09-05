const request = require("supertest");
const app = require("../../src/app");
const Tenant = require("../../src/modules/tenants/tenant.model");
const User = require("../../src/modules/users/user.model");
const AuditLog = require("../../src/modules/audit/audit-log.model");
const { ROLES } = require("../../src/shared/constants/roles");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { AUDIT_ACTIONS } = require("../../src/shared/constants/audit-actions");
const { ELVA_DEFAULT_BRANDING } = require("../../src/shared/constants/default-branding");
const { DEFAULT_CUSTOMER_LABEL } = require("../../src/shared/constants/customer-labels");
const { buildEmailBranding } = require("../../src/shared/utils/tenant-ops.util");
const { loginAgent } = require("../helpers/seed");
const PlatformAdmin = require("../../src/modules/platform-admin/platform-admin.model");
const { PLATFORM_ROLES } = require("../../src/shared/constants/platform");

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const tenantHeaders = (token, slug) => ({
  ...authHeader(token),
  "X-Tenant-Slug": slug
});

const createTenantWorkspace = async ({ slug, name }) => {
  const tenant = await Tenant.create({
    name,
    slug,
    status: TENANT_STATUSES.ACTIVE,
    settings: {
      organization: {},
      branding: {},
      support: {},
      notifications: {}
    }
  });

  const admin = await User.create({
    tenantId: tenant._id,
    email: `admin@${slug}.test`,
    password: "Admin@12345",
    firstName: "Admin",
    lastName: "User",
    role: ROLES.ADMIN,
    isActive: true
  });

  const agent = await User.create({
    tenantId: tenant._id,
    email: `agent@${slug}.test`,
    password: "Agent@12345",
    firstName: "Agent",
    lastName: "One",
    role: ROLES.AGENT,
    isActive: true
  });

  return { tenant, admin, agent };
};

describe("Phase 12 tenant branding and customization", () => {
  test("branding read is tenant-scoped; public payload is safe", async () => {
    const a = await createTenantWorkspace({ slug: "brand-a", name: "Brand A Co" });
    const b = await createTenantWorkspace({ slug: "brand-b", name: "Brand B Co" });
    const tokenA = await loginAgent(app, a.admin.email, "Admin@12345", { tenantSlug: "brand-a" });

    await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(tokenA, "brand-a"))
      .send({
        supportDisplayName: "A Support",
        primaryColor: "#112233",
        secondaryColor: "#445566",
        loginTitle: "Welcome A",
        loginSubtitle: "Track requests"
      })
      .expect(200);

    await request(app)
      .patch("/api/workspace/support")
      .set(tenantHeaders(tokenA, "brand-a"))
      .send({ customerLabel: "CUSTOMER" })
      .expect(200);

    const publicA = await request(app)
      .get("/api/workspace/branding/public")
      .set({ "X-Tenant-Slug": "brand-a" });
    expect(publicA.status).toBe(200);
    expect(publicA.body.data.supportDisplayName).toBe("A Support");
    expect(publicA.body.data.primaryColor).toBe("#112233");
    expect(publicA.body.data.secondaryColor).toBe("#445566");
    expect(publicA.body.data.customerLabel).toBe("CUSTOMER");
    expect(publicA.body.data.loginTitle).toBe("Welcome A");
    expect(publicA.body.data).not.toHaveProperty("settings");
    expect(JSON.stringify(publicA.body.data)).not.toMatch(/password|secret|tokenHash/i);
    // No raw ObjectId tenant id in public payload
    expect(publicA.body.data).not.toHaveProperty("tenantId");
    expect(publicA.body.data).not.toHaveProperty("_id");

    const publicB = await request(app)
      .get("/api/workspace/branding/public")
      .set({ "X-Tenant-Slug": "brand-b" });
    expect(publicB.status).toBe(200);
    expect(publicB.body.data.supportDisplayName).not.toBe("A Support");
    expect(publicB.body.data.customerLabel).toBe(DEFAULT_CUSTOMER_LABEL);

    const cross = await request(app)
      .get("/api/workspace/settings")
      .set(tenantHeaders(tokenA, "brand-b"));
    expect(cross.status).toBe(403);
  });

  test("branding update ADMIN-only; invalid colors rejected; valid accepted", async () => {
    const { admin, agent } = await createTenantWorkspace({ slug: "color-co", name: "Color Co" });
    const adminToken = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "color-co" });
    const agentToken = await loginAgent(app, agent.email, "Agent@12345", { tenantSlug: "color-co" });

    const agentDenied = await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(agentToken, "color-co"))
      .send({ primaryColor: "#abcdef" });
    expect(agentDenied.status).toBe(403);

    const invalid = await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(adminToken, "color-co"))
      .send({ primaryColor: "red" });
    expect(invalid.status).toBe(400);

    const cssInject = await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(adminToken, "color-co"))
      .send({ primaryColor: "url(javascript:alert(1))" });
    expect(cssInject.status).toBe(400);

    const valid = await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(adminToken, "color-co"))
      .send({ primaryColor: "#112233", secondaryColor: "#445566" });
    expect(valid.status).toBe(200);
    expect(valid.body.data.branding.primaryColor).toBe("#112233");
    expect(valid.body.data.branding.secondaryColor).toBe("#445566");
  });

  test("customer label validation and support settings audit", async () => {
    const { tenant, admin, agent } = await createTenantWorkspace({
      slug: "label-co",
      name: "Label Co"
    });
    const adminToken = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "label-co" });
    const agentToken = await loginAgent(app, agent.email, "Agent@12345", { tenantSlug: "label-co" });

    const bad = await request(app)
      .patch("/api/workspace/support")
      .set(tenantHeaders(adminToken, "label-co"))
      .send({ customerLabel: "PARTNER" });
    expect(bad.status).toBe(400);

    const agentDenied = await request(app)
      .patch("/api/workspace/support")
      .set(tenantHeaders(agentToken, "label-co"))
      .send({ customerLabel: "MERCHANT" });
    expect(agentDenied.status).toBe(403);

    const ok = await request(app)
      .patch("/api/workspace/support")
      .set(tenantHeaders(adminToken, "label-co"))
      .send({ customerLabel: "MERCHANT" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.support.customerLabel).toBe("MERCHANT");

    const audits = await AuditLog.find({
      tenantId: tenant._id,
      action: {
        $in: [
          AUDIT_ACTIONS.WORKSPACE_SUPPORT_SETTINGS_UPDATED,
          AUDIT_ACTIONS.WORKSPACE_CUSTOMER_LABEL_UPDATED
        ]
      }
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  test("cross-tenant branding update denied; client tenantId ignored", async () => {
    const a = await createTenantWorkspace({ slug: "iso-a", name: "Iso A" });
    const b = await createTenantWorkspace({ slug: "iso-b", name: "Iso B" });
    const tokenA = await loginAgent(app, a.admin.email, "Admin@12345", { tenantSlug: "iso-a" });

    await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(tokenA, "iso-a"))
      .send({
        supportDisplayName: "Iso A Support",
        tenantId: String(b.tenant._id)
      })
      .expect(200);

    const bPublic = await request(app)
      .get("/api/workspace/branding/public")
      .set({ "X-Tenant-Slug": "iso-b" });
    expect(bPublic.body.data.supportDisplayName).not.toBe("Iso A Support");

    const crossPatch = await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(tokenA, "iso-b"))
      .send({ supportDisplayName: "Hijack" });
    expect(crossPatch.status).toBe(403);
  });

  test("platform token cannot mutate tenant branding; tenant token boundary", async () => {
    const { admin } = await createTenantWorkspace({ slug: "bound-co", name: "Bound Co" });

    await PlatformAdmin.create({
      email: "super@phase12.platform",
      password: "Platform@12345",
      name: "Phase12 Super",
      role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN,
      isActive: true
    });

    const platformLogin = await request(app)
      .post("/api/platform/auth/login")
      .send({ email: "super@phase12.platform", password: "Platform@12345" });
    expect(platformLogin.status).toBe(200);
    const platformToken = platformLogin.body.data.token;

    const platformDenied = await request(app)
      .patch("/api/workspace/branding")
      .set({
        Authorization: `Bearer ${platformToken}`,
        "X-Tenant-Slug": "bound-co"
      })
      .send({ supportDisplayName: "Platform Hijack" });
    expect([401, 403]).toContain(platformDenied.status);

    const tenantToken = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "bound-co" });
    const tenantOk = await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(tenantToken, "bound-co"))
      .send({ supportDisplayName: "Bound Support" });
    expect(tenantOk.status).toBe(200);
  });

  test("ELVA fallback/default branding and email branding graceful", async () => {
    const tenant = await Tenant.create({
      name: "Fallback Co",
      slug: "fallback-co",
      status: TENANT_STATUSES.ACTIVE,
      settings: { organization: {}, branding: {}, support: {}, notifications: {} }
    });

    const branding = buildEmailBranding(tenant);
    expect(branding.supportDisplayName).toContain("Support");
    expect(branding.primaryColor).toBe(ELVA_DEFAULT_BRANDING.primaryColor);
    expect(branding.logoUrl).toBeNull();

    const elvaEmpty = buildEmailBranding(null);
    expect(elvaEmpty.supportDisplayName).toBe(ELVA_DEFAULT_BRANDING.supportDisplayName);
    expect(elvaEmpty.primaryColor).toBe(ELVA_DEFAULT_BRANDING.primaryColor);
  });

  test("branding audit events created on update", async () => {
    const { tenant, admin } = await createTenantWorkspace({ slug: "audit-brand", name: "Audit Brand" });
    const token = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "audit-brand" });

    await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(token, "audit-brand"))
      .send({ supportDisplayName: "Audited Support", primaryColor: "#123456" })
      .expect(200);

    const logs = await AuditLog.find({
      tenantId: tenant._id,
      action: AUDIT_ACTIONS.WORKSPACE_BRANDING_UPDATED
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(String(logs[0].tenantId)).toBe(String(tenant._id));
  });

  test("core APIs still work when branding incomplete", async () => {
    const { admin } = await createTenantWorkspace({ slug: "core-ok", name: "Core Ok" });
    const token = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "core-ok" });

    const settings = await request(app)
      .get("/api/workspace/settings")
      .set(tenantHeaders(token, "core-ok"));
    expect(settings.status).toBe(200);
    expect(settings.body.data.support.customerLabel).toBe(DEFAULT_CUSTOMER_LABEL);

    const publicBranding = await request(app)
      .get("/api/workspace/branding/public")
      .set({ "X-Tenant-Slug": "core-ok" });
    expect(publicBranding.status).toBe(200);
    expect(publicBranding.body.data.logoAvailable).toBe(false);
  });
});
