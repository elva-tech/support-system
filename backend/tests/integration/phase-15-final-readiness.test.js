const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const env = require("../../src/config/env");
const Tenant = require("../../src/modules/tenants/tenant.model");
const User = require("../../src/modules/users/user.model");
const Team = require("../../src/modules/teams/team.model");
const Application = require("../../src/modules/applications/application.model");
const Ticket = require("../../src/modules/tickets/ticket.model");
const MerchantProfile = require("../../src/modules/merchants/merchant-profile.model");
const OtpSession = require("../../src/modules/merchants/otp-session.model");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { ROLES } = require("../../src/shared/constants/roles");
const { TICKET_STATUSES } = require("../../src/shared/constants/ticket-statuses");
const { loginAgent } = require("../helpers/seed");
const { hashValue } = require("../../src/shared/utils/token.util");
const logger = require("../../src/shared/utils/logger");
const { PLATFORM_IDENTITY_TYPE, PLATFORM_ROLES, PLATFORM_ADMIN_STATUSES } = require("../../src/shared/constants/platform");
const PlatformAdmin = require("../../src/modules/platform-admin/platform-admin.model");
const merchantService = require("../../src/modules/merchants/merchant.service");
const { parseTenantSlugFromHostname } = require("../../src/shared/utils/tenant-host.util");

const createWorkspace = async ({ slug, name }) => {
  const tenant = await Tenant.create({
    name,
    slug,
    status: TENANT_STATUSES.ACTIVE,
    settings: { organization: {}, branding: {}, support: {}, notifications: {} }
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
  return { tenant, admin };
};

describe("Phase 15 final readiness", () => {
  test("hostname resolution: reserved / platform / central-support / tenant / invalid", () => {
    const base = "elvasupport.in";
    expect(parseTenantSlugFromHostname(`admin.${base}`, base).kind).toBe("platform");
    expect(parseTenantSlugFromHostname(`support.${base}`, base).kind).toBe("central-support");
    expect(parseTenantSlugFromHostname(`api.${base}`, base).kind).toBe("reserved");
    expect(parseTenantSlugFromHostname(`www.${base}`, base).kind).toBe("reserved");
    expect(parseTenantSlugFromHostname(`acme.${base}`, base)).toEqual({
      kind: "tenant",
      slug: "acme"
    });
    expect(parseTenantSlugFromHostname(`a.b.${base}`, base).kind).toBe("invalid");
    expect(parseTenantSlugFromHostname("evil.com", base).kind).toBe("external");
  });

  test("platform JWT cannot access tenant APIs; tenant JWT cannot access platform APIs", async () => {
    const { tenant, admin } = await createWorkspace({ slug: "bound15", name: "Bound 15" });
    const token = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: tenant.slug });

    const platformAdmin = await PlatformAdmin.create({
      email: "super@platform15.test",
      password: "Platform@12345",
      name: "Super",
      role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN,
      status: PLATFORM_ADMIN_STATUSES.ACTIVE
    });
    const platformToken = jwt.sign(
      {
        sub: String(platformAdmin._id),
        identityType: PLATFORM_IDENTITY_TYPE,
        role: platformAdmin.role
      },
      env.jwtSecret,
      { expiresIn: "1h" }
    );

    const tenantBlocked = await request(app)
      .get("/api/workspace/settings")
      .set("Authorization", `Bearer ${platformToken}`)
      .set("X-Tenant-Slug", tenant.slug);
    expect(tenantBlocked.status).toBe(401);

    const platformBlocked = await request(app)
      .get("/api/platform/tenants")
      .set("Authorization", `Bearer ${token}`);
    expect(platformBlocked.status).toBe(401);
  });

  test("logs-viewer purpose JWT cannot access tenant APIs", async () => {
    const { tenant, admin } = await createWorkspace({ slug: "logs15", name: "Logs 15" });
    const logsToken = jwt.sign(
      { sub: String(admin._id), purpose: "logs-viewer" },
      env.jwtSecret,
      { expiresIn: "1h" }
    );

    const res = await request(app)
      .get("/api/workspace/settings")
      .set("Authorization", `Bearer ${logsToken}`)
      .set("X-Tenant-Slug", tenant.slug);
    expect(res.status).toBe(401);
  });

  test("cross-tenant ticket transfer to foreign team is rejected", async () => {
    const a = await createWorkspace({ slug: "xfer-a", name: "Xfer A" });
    const b = await createWorkspace({ slug: "xfer-b", name: "Xfer B" });

    const appA = await Application.create({
      tenantId: a.tenant._id,
      name: "App A",
      code: "AXA",
      isActive: true
    });
    const teamA = await Team.create({
      tenantId: a.tenant._id,
      name: "Team A",
      applicationId: appA._id,
      isActive: true
    });
    const Module = require("../../src/modules/modules/module.model");
    const moduleA = await Module.create({
      name: "Orders",
      code: "ORD",
      applicationId: appA._id,
      defaultTeamId: teamA._id,
      isActive: true,
      tenantId: a.tenant._id
    });
    const appB = await Application.create({
      tenantId: b.tenant._id,
      name: "App B",
      code: "AXB",
      isActive: true
    });
    const teamB = await Team.create({
      tenantId: b.tenant._id,
      name: "Team B",
      applicationId: appB._id,
      isActive: true
    });

    const merchant = await MerchantProfile.create({
      tenantId: a.tenant._id,
      applicationId: appA._id,
      applicationCode: "AXA",
      externalUserId: "m-xfer",
      merchantName: "M",
      email: "m@xfer-a.test",
      isActive: true
    });

    const ticket = await Ticket.create({
      tenantId: a.tenant._id,
      ticketNumber: "AXA-2026-900001",
      applicationId: appA._id,
      applicationCode: "AXA",
      moduleId: moduleA._id,
      merchantId: merchant._id,
      teamId: teamA._id,
      subject: "xfer",
      description: "xfer",
      status: TICKET_STATUSES.OPEN,
      createdBy: a.admin._id
    });

    const token = await loginAgent(app, a.admin.email, "Admin@12345", { tenantSlug: "xfer-a" });
    const res = await request(app)
      .patch(`/api/tickets/${ticket._id}/transfer`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Tenant-Slug", "xfer-a")
      .send({ teamId: teamB._id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid team/i);

    const reloaded = await Ticket.findById(ticket._id);
    expect(String(reloaded.teamId)).toBe(String(teamA._id));
  });

  test("OTP sessions are tenant-scoped (same email cannot cross-verify)", async () => {
    const a = await createWorkspace({ slug: "otp-a", name: "OTP A" });
    const b = await createWorkspace({ slug: "otp-b", name: "OTP B" });
    const appA = await Application.create({
      tenantId: a.tenant._id,
      name: "App",
      code: "OTA",
      isActive: true
    });
    const appB = await Application.create({
      tenantId: b.tenant._id,
      name: "App",
      code: "OTB",
      isActive: true
    });

    await MerchantProfile.create({
      tenantId: a.tenant._id,
      applicationId: appA._id,
      applicationCode: "OTA",
      externalUserId: "ext-a",
      merchantName: "Same Email",
      email: "same@otp.test",
      isActive: true
    });
    await MerchantProfile.create({
      tenantId: b.tenant._id,
      applicationId: appB._id,
      applicationCode: "OTB",
      externalUserId: "ext-b",
      merchantName: "Same Email",
      email: "same@otp.test",
      isActive: true
    });

    await OtpSession.create({
      email: "same@otp.test",
      tenantId: a.tenant._id,
      otpCode: hashValue("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: false
    });

    await expect(
      merchantService.verifyOtp("same@otp.test", "123456", {}, { tenantId: b.tenant._id })
    ).rejects.toMatchObject({ statusCode: 400 });

    const ok = await merchantService.verifyOtp("same@otp.test", "123456", {}, { tenantId: a.tenant._id });
    expect(ok.sessionToken).toBeTruthy();
  });

  test("internal merchant sync requires tenantSlug when no context", async () => {
    await expect(
      merchantService.syncMerchant({
        applicationCode: "NOPE",
        externalUserId: "x",
        merchantName: "X",
        email: "x@test.com"
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("access logs redact invitation token path segments", () => {
    const fields = logger.buildRequestLogFields({
      requestId: "r1",
      method: "GET",
      originalUrl: "/api/onboarding/invitation/super-secret-token-value-here"
    });
    expect(fields.path).toBe("/api/onboarding/invitation/[REDACTED]");
    expect(fields.path).not.toContain("super-secret");
  });

  test("IMAP poll endpoint is not tenant-admin callable", async () => {
    const { tenant, admin } = await createWorkspace({ slug: "poll15", name: "Poll 15" });
    const token = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: tenant.slug });
    const res = await request(app)
      .post("/api/omnichannel/email/poll")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Tenant-Slug", tenant.slug);
    expect(res.status).toBe(401);
  });
});
