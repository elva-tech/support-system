const request = require("supertest");
const app = require("../../src/app");
const Tenant = require("../../src/modules/tenants/tenant.model");
const User = require("../../src/modules/users/user.model");
const AuditLog = require("../../src/modules/audit/audit-log.model");
const EmailThread = require("../../src/modules/email/email-thread.model");
const Ticket = require("../../src/modules/tickets/ticket.model");
const Application = require("../../src/modules/applications/application.model");
const Module = require("../../src/modules/modules/module.model");
const Team = require("../../src/modules/teams/team.model");
const MerchantProfile = require("../../src/modules/merchants/merchant-profile.model");
const PlatformAdmin = require("../../src/modules/platform-admin/platform-admin.model");
const PlatformAuditLog = require("../../src/modules/platform-admin/platform-audit-log.model");
const { ROLES } = require("../../src/shared/constants/roles");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { USER_STATUSES } = require("../../src/shared/constants/user-lifecycle");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../src/shared/constants/audit-actions");
const { PLATFORM_ROLES, PLATFORM_ADMIN_STATUSES } = require("../../src/shared/constants/platform");
const { loginAgent } = require("../helpers/seed");
const { toPublicAuditLog } = require("../../src/modules/audit/audit-redaction.util");
const { runIntegrityScan } = require("../../src/modules/tenant-integrity/integrity.scanner.service");
const { INTEGRITY_COLLECTIONS } = require("../../src/modules/tenant-integrity/integrity.constants");
const { EMAIL_DIRECTION } = require("../../src/shared/constants/communication-channels");

const tenantHeaders = (token, slug) => ({
  Authorization: `Bearer ${token}`,
  "X-Tenant-Slug": slug
});

const createWorkspace = async ({ slug, name }) => {
  const tenant = await Tenant.create({
    name,
    slug,
    status: TENANT_STATUSES.ACTIVE,
    settings: { organization: {}, branding: {}, notifications: {} }
  });
  const appDoc = await Application.create({
    tenantId: tenant._id,
    name: "App",
    code: "APP",
    isActive: true
  });
  const moduleDoc = await Module.create({
    name: "Orders",
    code: "ORDERS",
    applicationId: appDoc._id,
    isActive: true
  });
  const team = await Team.create({
    tenantId: tenant._id,
    name: "Support",
    applicationId: appDoc._id,
    isActive: true
  });
  const admin = await User.create({
    tenantId: tenant._id,
    email: `admin@${slug}.test`,
    password: "Admin@12345",
    firstName: "Admin",
    lastName: "User",
    role: ROLES.ADMIN,
    status: USER_STATUSES.ACTIVE,
    isActive: true
  });
  const lead = await User.create({
    tenantId: tenant._id,
    email: `lead@${slug}.test`,
    password: "Lead@12345",
    firstName: "Lead",
    lastName: "One",
    role: ROLES.TEAM_LEAD,
    teamId: team._id,
    status: USER_STATUSES.ACTIVE,
    isActive: true
  });
  return { tenant, app: appDoc, module: moduleDoc, team, admin, lead };
};

const createPlatformAdmin = async ({ email, role, password = "SuperAdmin@123" }) => {
  return PlatformAdmin.create({
    name: "Platform User",
    email,
    password,
    role,
    status: PLATFORM_ADMIN_STATUSES.ACTIVE
  });
};

const platformLogin = async (email, password = "SuperAdmin@123") => {
  const res = await request(app).post("/api/platform/auth/login").send({ email, password });
  return res.body.data.token;
};

describe("Phase 11 audit and tenant integrity", () => {
  test("tenant ADMIN can list own audit; TEAM_LEAD denied; cross-tenant hidden; redaction works", async () => {
    const a = await createWorkspace({ slug: "audit-a", name: "Audit A" });
    const b = await createWorkspace({ slug: "audit-b", name: "Audit B" });
    const tokenA = await loginAgent(app, a.admin.email, "Admin@12345", { tenantSlug: a.tenant.slug });
    const leadToken = await loginAgent(app, a.lead.email, "Lead@12345", { tenantSlug: a.tenant.slug });
    const tokenB = await loginAgent(app, b.admin.email, "Admin@12345", { tenantSlug: b.tenant.slug });

    await AuditLog.create({
      tenantId: a.tenant._id,
      entityType: ENTITY_TYPES.USER,
      entityId: a.admin._id,
      action: AUDIT_ACTIONS.USER_INVITED,
      actorType: ACTOR_TYPES.AGENT,
      actorId: a.admin._id,
      actorName: "Admin User",
      metadata: { email: "x@a.test", password: "secret", invitationToken: "raw" }
    });
    await AuditLog.create({
      tenantId: b.tenant._id,
      entityType: ENTITY_TYPES.USER,
      entityId: b.admin._id,
      action: AUDIT_ACTIONS.USER_INVITED,
      actorType: ACTOR_TYPES.AGENT,
      actorId: b.admin._id,
      actorName: "Admin B",
      metadata: { email: "x@b.test" }
    });

    await request(app)
      .get("/api/audit")
      .set(tenantHeaders(leadToken, a.tenant.slug))
      .expect(403);

    const listA = await request(app)
      .get("/api/audit")
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(200);

    expect(listA.body.pagination.total).toBeGreaterThanOrEqual(1);
    expect(listA.body.data.every((e) => String(e.tenantId) === String(a.tenant._id))).toBe(true);
    expect(listA.body.data.some((e) => String(e.tenantId) === String(b.tenant._id))).toBe(false);

    const withSecret = listA.body.data.find((e) => e.metadata?.password || e.metadata?.invitationToken);
    if (withSecret) {
      expect(withSecret.metadata.password).toBe("[REDACTED]");
      expect(withSecret.metadata.invitationToken).toBe("[REDACTED]");
    }

    const filtered = await request(app)
      .get("/api/audit?action=USER_INVITED&page=1&limit=10")
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(200);
    expect(filtered.body.data.every((e) => e.action === "USER_INVITED")).toBe(true);

    const search = await request(app)
      .get("/api/audit?search=USER_INVITED")
      .set(tenantHeaders(tokenB, b.tenant.slug))
      .expect(200);
    expect(search.body.data.every((e) => String(e.tenantId) === String(b.tenant._id))).toBe(true);

    const redacted = toPublicAuditLog({
      metadata: { token: "abc", ticketNumber: "T-1" }
    });
    expect(redacted.metadata.token).toBe("[REDACTED]");
    expect(redacted.metadata.ticketNumber).toBe("T-1");
  });

  test("platform audit accessible to authorized roles; tenant JWT denied", async () => {
    const a = await createWorkspace({ slug: "plat-audit", name: "Plat Audit" });
    const tenantToken = await loginAgent(app, a.admin.email, "Admin@12345", {
      tenantSlug: a.tenant.slug
    });
    await createPlatformAdmin({
      email: "super@plat.test",
      role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN
    });
    await createPlatformAdmin({
      email: "support@plat.test",
      role: PLATFORM_ROLES.PLATFORM_SUPPORT
    });
    const superToken = await platformLogin("super@plat.test");
    const supportToken = await platformLogin("support@plat.test");

    await request(app)
      .get("/api/platform/audit")
      .set({ Authorization: `Bearer ${tenantToken}` })
      .expect(401);

    await request(app)
      .get("/api/platform/audit")
      .set({ Authorization: `Bearer ${supportToken}` })
      .expect(403);

    const ok = await request(app)
      .get("/api/platform/audit?limit=10")
      .set({ Authorization: `Bearer ${superToken}` })
      .expect(200);
    expect(Array.isArray(ok.body.data.items)).toBe(true);
  });

  test("integrity detects missing tenant, mismatch, and auto-repairable email thread", async () => {
    const a = await createWorkspace({ slug: "integ-a", name: "Integ A" });
    const merchant = await MerchantProfile.create({
      tenantId: a.tenant._id,
      applicationId: a.app._id,
      applicationCode: a.app.code,
      email: "m@integ.test",
      merchantName: "M",
      externalUserId: "ext-1",
      isActive: true
    });
    const ticket = await Ticket.create({
      tenantId: a.tenant._id,
      ticketNumber: "IN-1001",
      subject: "t",
      description: "d",
      applicationId: a.app._id,
      applicationCode: a.app.code,
      moduleId: a.module._id,
      teamId: a.team._id,
      merchantId: merchant._id
    });

    const thread = await EmailThread.create({
      tenantId: null,
      ticketId: ticket._id,
      messageId: `<msg-${Date.now()}@test>`,
      direction: EMAIL_DIRECTION.INBOUND,
      subject: "hello"
    });

    const otherApp = await Application.create({
      tenantId: a.tenant._id,
      name: "Other",
      code: "OTH",
      isActive: true
    });
    // Force mismatch: create ticket-like mismatch by scanning app vs ticket — use second tenant app
    const b = await createWorkspace({ slug: "integ-b", name: "Integ B" });
    await Ticket.create({
      tenantId: a.tenant._id,
      ticketNumber: "IN-MISMATCH",
      subject: "bad",
      description: "d",
      applicationId: b.app._id,
      applicationCode: b.app.code,
      moduleId: b.module._id,
      teamId: a.team._id,
      merchantId: merchant._id
    });

    const { findings, summary } = await runIntegrityScan({
      collections: [INTEGRITY_COLLECTIONS.emailthreads, INTEGRITY_COLLECTIONS.tickets]
    });

    expect(summary.totalFindings).toBeGreaterThan(0);
    const missing = findings.find(
      (f) => f.recordId === String(thread._id) && f.issueType === "MISSING_TENANT"
    );
    expect(missing).toBeTruthy();
    expect(missing.repairable).toBe(true);
    expect(missing.suggestedTenantId).toBe(String(a.tenant._id));

    const mismatch = findings.find((f) => f.issueType === "TENANT_MISMATCH");
    expect(mismatch).toBeTruthy();
    expect(mismatch.repairable).toBe(false);

    void otherApp;
  });

  test("SUPER_ADMIN can repair; dry-run changes nothing; ADMIN/SUPPORT cannot repair", async () => {
    const a = await createWorkspace({ slug: "repair-a", name: "Repair A" });
    const merchant = await MerchantProfile.create({
      tenantId: a.tenant._id,
      applicationId: a.app._id,
      applicationCode: a.app.code,
      email: "r@repair.test",
      merchantName: "R",
      externalUserId: "ext-r",
      isActive: true
    });
    const ticket = await Ticket.create({
      tenantId: a.tenant._id,
      ticketNumber: "RP-1",
      subject: "t",
      description: "d",
      applicationId: a.app._id,
      applicationCode: a.app.code,
      moduleId: a.module._id,
      teamId: a.team._id,
      merchantId: merchant._id
    });
    const thread = await EmailThread.create({
      tenantId: null,
      ticketId: ticket._id,
      messageId: `<repair-${Date.now()}@test>`,
      direction: EMAIL_DIRECTION.INBOUND,
      subject: "repair me"
    });

    await createPlatformAdmin({
      email: "super-r@plat.test",
      role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN
    });
    await createPlatformAdmin({
      email: "admin-r@plat.test",
      role: PLATFORM_ROLES.PLATFORM_ADMIN
    });
    await createPlatformAdmin({
      email: "support-r@plat.test",
      role: PLATFORM_ROLES.PLATFORM_SUPPORT
    });
    const superToken = await platformLogin("super-r@plat.test");
    const adminToken = await platformLogin("admin-r@plat.test");
    const supportToken = await platformLogin("support-r@plat.test");

    await request(app)
      .post("/api/platform/integrity/repair")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        collection: "emailthreads",
        recordId: thread._id,
        tenantId: a.tenant._id,
        confirmation: true
      })
      .expect(403);

    await request(app)
      .post("/api/platform/integrity/repair")
      .set({ Authorization: `Bearer ${supportToken}` })
      .send({
        collection: "emailthreads",
        recordId: thread._id,
        tenantId: a.tenant._id,
        confirmation: true
      })
      .expect(403);

    const dry = await request(app)
      .post("/api/platform/integrity/repair-auto")
      .set({ Authorization: `Bearer ${superToken}` })
      .send({ collection: "emailthreads", dryRun: true })
      .expect(200);
    expect(dry.body.data.dryRun).toBe(true);
    const stillNull = await EmailThread.findById(thread._id);
    expect(stillNull.tenantId).toBeNull();

    await request(app)
      .post("/api/platform/integrity/repair-auto")
      .set({ Authorization: `Bearer ${superToken}` })
      .send({ collection: "emailthreads", dryRun: false })
      .expect(400);

    const repaired = await request(app)
      .post("/api/platform/integrity/repair")
      .set({ Authorization: `Bearer ${superToken}` })
      .send({
        collection: "emailthreads",
        recordId: thread._id,
        tenantId: a.tenant._id,
        confirmation: true
      })
      .expect(200);
    expect(repaired.body.data.newTenantId).toBe(String(a.tenant._id));

    const after = await EmailThread.findById(thread._id);
    expect(String(after.tenantId)).toBe(String(a.tenant._id));

    const audit = await PlatformAuditLog.findOne({ action: "TENANT_DATA_REPAIRED" });
    expect(audit).toBeTruthy();

    await request(app)
      .post("/api/platform/integrity/repair")
      .set({ Authorization: `Bearer ${superToken}` })
      .send({
        collection: "hackers",
        recordId: thread._id,
        tenantId: a.tenant._id,
        confirmation: true
      })
      .expect(400);

    const summary = await request(app)
      .get("/api/platform/integrity/summary")
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(200);
    expect(summary.body.data.totalCollections).toBeGreaterThan(0);
  });
});
