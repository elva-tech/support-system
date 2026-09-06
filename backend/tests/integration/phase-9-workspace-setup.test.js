const request = require("supertest");
const app = require("../../src/app");
const Tenant = require("../../src/modules/tenants/tenant.model");
const Application = require("../../src/modules/applications/application.model");
const Team = require("../../src/modules/teams/team.model");
const User = require("../../src/modules/users/user.model");
const Module = require("../../src/modules/modules/module.model");
const { ROLES } = require("../../src/shared/constants/roles");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { WORKSPACE_SETUP_STATUSES } = require("../../src/shared/constants/workspace-setup");
const { buildEmailBranding } = require("../../src/shared/utils/tenant-ops.util");
const { seedTestData, loginAgent } = require("../helpers/seed");
const PlatformAdmin = require("../../src/modules/platform-admin/platform-admin.model");
const { PLATFORM_ROLES } = require("../../src/shared/constants/platform");

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const tenantHeaders = (token, slug) => ({
  ...authHeader(token),
  "X-Tenant-Slug": slug
});

const createTenantWorkspace = async ({ slug, name, withOps = false }) => {
  const tenant = await Tenant.create({
    name,
    slug,
    status: TENANT_STATUSES.ACTIVE,
    settings: {
      organization: {},
      branding: {},
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

  let appDoc = null;
  let team = null;
  let agent = null;

  if (withOps) {
    appDoc = await Application.create({
      tenantId: tenant._id,
      name: "Main App",
      code: "APP",
      isActive: true
    });
    team = await Team.create({
      tenantId: tenant._id,
      name: "Support",
      applicationId: appDoc._id,
      isActive: true
    });
    agent = await User.create({
      tenantId: tenant._id,
      email: `agent@${slug}.test`,
      password: "Agent@12345",
      firstName: "Agent",
      lastName: "One",
      role: ROLES.AGENT,
      teamId: team._id,
      isActive: true
    });
  }

  return { tenant, admin, app: appDoc, team, agent };
};

describe("Phase 9 workspace setup", () => {
  test("tenant ADMIN can get and update organization settings; TEAM_LEAD and AGENT cannot", async () => {
    const { tenant, admin, team } = await createTenantWorkspace({
      slug: "abc-co",
      name: "ABC Technologies",
      withOps: true
    });

    const lead = await User.create({
      tenantId: tenant._id,
      email: "lead@abc-co.test",
      password: "Lead@12345",
      firstName: "Lead",
      lastName: "User",
      role: ROLES.TEAM_LEAD,
      teamId: team._id,
      isActive: true
    });

    const agent = await User.findOne({ tenantId: tenant._id, role: ROLES.AGENT });

    const adminToken = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "abc-co" });
    const leadToken = await loginAgent(app, lead.email, "Lead@12345", { tenantSlug: "abc-co" });
    const agentToken = await loginAgent(app, agent.email, "Agent@12345", { tenantSlug: "abc-co" });

    const getRes = await request(app)
      .get("/api/workspace/settings")
      .set(tenantHeaders(adminToken, "abc-co"));
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.tenant.slug).toBe("abc-co");
    expect(getRes.body.data.setup.status).toBeDefined();

    const patchOrg = await request(app)
      .patch("/api/workspace/organization")
      .set(tenantHeaders(adminToken, "abc-co"))
      .send({
        displayName: "ABC Technologies",
        supportEmail: "help@abc.test",
        primaryContactName: "Pat Admin",
        timezone: "Asia/Kolkata",
        country: "IN"
      });
    expect(patchOrg.status).toBe(200);
    expect(patchOrg.body.data.organization.displayName).toBe("ABC Technologies");
    expect(patchOrg.body.data.setup.steps.organization).toBe(true);

    const leadDenied = await request(app)
      .patch("/api/workspace/organization")
      .set(tenantHeaders(leadToken, "abc-co"))
      .send({ displayName: "Nope" });
    expect(leadDenied.status).toBe(403);

    const agentDenied = await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(agentToken, "abc-co"))
      .send({ supportDisplayName: "Nope Support" });
    expect(agentDenied.status).toBe(403);
  });

  test("cross-tenant workspace settings isolation; client-supplied tenantId ignored", async () => {
    const a = await createTenantWorkspace({ slug: "tenant-a", name: "Tenant A" });
    const b = await createTenantWorkspace({ slug: "tenant-b", name: "Tenant B" });

    const tokenA = await loginAgent(app, a.admin.email, "Admin@12345", { tenantSlug: "tenant-a" });
    const tokenB = await loginAgent(app, b.admin.email, "Admin@12345", { tenantSlug: "tenant-b" });

    await request(app)
      .patch("/api/workspace/organization")
      .set(tenantHeaders(tokenA, "tenant-a"))
      .send({
        displayName: "A Org",
        supportEmail: "a@test.com",
        tenantId: String(b.tenant._id)
      })
      .expect(200);

    const bSettings = await request(app)
      .get("/api/workspace/settings")
      .set(tenantHeaders(tokenB, "tenant-b"));
    expect(bSettings.body.data.organization.displayName || "").not.toBe("A Org");

    const cross = await request(app)
      .get("/api/workspace/settings")
      .set(tenantHeaders(tokenA, "tenant-b"));
    expect(cross.status).toBe(403);
  });

  test("setup progress updates when team and application exist; branding email context", async () => {
    const { tenant, admin } = await createTenantWorkspace({
      slug: "progress-co",
      name: "Progress Co"
    });
    const token = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "progress-co" });

    let status = await request(app)
      .get("/api/workspace/setup-status")
      .set(tenantHeaders(token, "progress-co"));
    expect(status.body.data.status).toBe(WORKSPACE_SETUP_STATUSES.NOT_STARTED);

    await request(app)
      .patch("/api/workspace/organization")
      .set(tenantHeaders(token, "progress-co"))
      .send({ displayName: "Progress Co", supportEmail: "ops@progress.test" })
      .expect(200);

    await request(app)
      .patch("/api/workspace/branding")
      .set(tenantHeaders(token, "progress-co"))
      .send({ supportDisplayName: "Progress Support", primaryColor: "#1a73e8" })
      .expect(200);

    const appDoc = await Application.create({
      tenantId: tenant._id,
      name: "Website",
      code: "WEB",
      isActive: true
    });
    await Team.create({
      tenantId: tenant._id,
      name: "Support Team",
      applicationId: appDoc._id,
      isActive: true
    });

    status = await request(app)
      .get("/api/workspace/setup-status")
      .set(tenantHeaders(token, "progress-co"));
    expect(status.body.data.steps.organization).toBe(true);
    expect(status.body.data.steps.branding).toBe(true);
    expect(status.body.data.steps.team).toBe(true);
    expect(status.body.data.steps.application).toBe(true);
    expect(status.body.data.status).toBe(WORKSPACE_SETUP_STATUSES.COMPLETED);

    const refreshed = await Tenant.findById(tenant._id);
    const branding = buildEmailBranding(refreshed);
    expect(branding.supportDisplayName).toBe("Progress Support");
  });

  test("logo upload validation and tenant isolation", async () => {
    const a = await createTenantWorkspace({ slug: "logo-a", name: "Logo A" });
    await createTenantWorkspace({ slug: "logo-b", name: "Logo B" });
    const tokenA = await loginAgent(app, a.admin.email, "Admin@12345", { tenantSlug: "logo-a" });

    const badMime = await request(app)
      .post("/api/workspace/branding/logo")
      .set(tenantHeaders(tokenA, "logo-a"))
      .attach("file", Buffer.from("%PDF-1.4"), {
        filename: "doc.pdf",
        contentType: "application/pdf"
      });
    expect(badMime.status).toBe(400);

    const ok = await request(app)
      .post("/api/workspace/branding/logo")
      .set(tenantHeaders(tokenA, "logo-a"))
      .attach("file", Buffer.from("fakepng"), {
        filename: "logo.png",
        contentType: "image/png"
      });
    expect(ok.status).toBe(201);
    expect(ok.body.data.branding.logoUrl).toBe("/api/workspace/branding/logo");

    const crossLogo = await request(app)
      .post("/api/workspace/branding/logo")
      .set(tenantHeaders(tokenA, "logo-b"))
      .attach("file", Buffer.from("fakepng"), {
        filename: "logo.png",
        contentType: "image/png"
      });
    expect(crossLogo.status).toBe(403);

    const bGet = await request(app)
      .get("/api/workspace/branding/logo")
      .set({ "X-Tenant-Slug": "logo-b" });
    expect(bGet.status).toBe(404);

    const aGet = await request(app)
      .get("/api/workspace/branding/logo")
      .set({ "X-Tenant-Slug": "logo-a" });
    expect(aGet.status).toBe(200);
    expect(aGet.headers["content-type"]).toMatch(/image\/png/);
  });

  test("modules are tenant-scoped; platform token cannot access workspace settings", async () => {
    const seeded = await seedTestData();
    const a = await createTenantWorkspace({
      slug: "mod-a",
      name: "Mod A",
      withOps: true
    });
    const b = await createTenantWorkspace({
      slug: "mod-b",
      name: "Mod B",
      withOps: true
    });

    const tokenA = await loginAgent(app, a.admin.email, "Admin@12345", { tenantSlug: "mod-a" });
    const tokenB = await loginAgent(app, b.admin.email, "Admin@12345", { tenantSlug: "mod-b" });

    const modA = await Module.create({
      name: "Orders",
      code: "ORD",
      applicationId: a.app._id,
      isActive: true
    });

    const listA = await request(app)
      .get("/api/modules")
      .set(tenantHeaders(tokenA, "mod-a"));
    expect(listA.status).toBe(200);
    expect(listA.body.data.some((m) => String(m._id) === String(modA._id))).toBe(true);

    const getCross = await request(app)
      .get(`/api/modules/${modA._id}`)
      .set(tenantHeaders(tokenB, "mod-b"));
    expect(getCross.status).toBe(400);

    await PlatformAdmin.create({
      name: "Super Admin",
      email: "super-phase9@platform.test",
      password: "Platform@12345",
      role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN
    });

    const platformLogin = await request(app)
      .post("/api/platform/auth/login")
      .send({ email: "super-phase9@platform.test", password: "Platform@12345" });
    expect(platformLogin.status).toBe(200);
    const platformToken = platformLogin.body.data.token;

    const platformToWorkspace = await request(app)
      .get("/api/workspace/settings")
      .set({
        Authorization: `Bearer ${platformToken}`,
        "X-Tenant-Slug": "mod-a"
      });
    expect(platformToWorkspace.status).toBe(401);

    const tenantToPlatform = await request(app)
      .get("/api/platform/tenants")
      .set(authHeader(tokenA));
    expect(tenantToPlatform.status).toBe(401);

    const elvaLogin = await request(app)
      .post("/api/auth/login")
      .set({ "X-Tenant-Slug": "elva" })
      .send({ email: seeded.admin.email, password: "Admin@12345" });
    expect(elvaLogin.status).toBe(200);
  });

  test("oversized logo rejected; branding skip disabled; public branding endpoint", async () => {
    const { admin } = await createTenantWorkspace({ slug: "skip-co", name: "Skip Co" });
    const token = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "skip-co" });

    const big = Buffer.alloc(2 * 1024 * 1024 + 10, 1);
    const oversized = await request(app)
      .post("/api/workspace/branding/logo")
      .set(tenantHeaders(token, "skip-co"))
      .attach("file", big, { filename: "big.png", contentType: "image/png" });
    expect(oversized.status).toBe(400);

    const skip = await request(app)
      .post("/api/workspace/setup/skip/branding")
      .set(tenantHeaders(token, "skip-co"));
    expect(skip.status).toBe(400);

    const pub = await request(app)
      .get("/api/workspace/branding/public")
      .set({ "X-Tenant-Slug": "skip-co" });
    expect(pub.status).toBe(200);
    expect(pub.body.data.tenantSlug).toBe("skip-co");
  });
});
