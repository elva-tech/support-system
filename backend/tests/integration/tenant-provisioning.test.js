const request = require("supertest");
const app = require("../../src/app");
const PlatformAdmin = require("../../src/modules/platform-admin/platform-admin.model");
const PlatformAuditLog = require("../../src/modules/platform-admin/platform-audit-log.model");
const Tenant = require("../../src/modules/tenants/tenant.model");
const TenantAdminInvitation = require("../../src/modules/tenant-provisioning/tenant-admin-invitation.model");
const User = require("../../src/modules/users/user.model");
const {
  PLATFORM_ROLES,
  PLATFORM_ADMIN_STATUSES,
  PLATFORM_AUDIT_ACTIONS
} = require("../../src/shared/constants/platform");
const {
  PROVISIONING_STATUSES,
  PROVISIONING_STEP_STATUSES,
  INVITATION_STATUSES
} = require("../../src/shared/constants/provisioning");
const { ROLES } = require("../../src/shared/constants/roles");
const { seedTestData, loginAgent } = require("../helpers/seed");
const {
  generateInvitationToken,
  hashInvitationToken,
  getInvitationExpiryDate
} = require("../../src/modules/tenant-provisioning/invitation-token.util");
const notificationManager = require("../../src/modules/notifications/notification-manager.service");

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const createPlatformAdmin = async (overrides = {}) =>
  PlatformAdmin.create({
    name: overrides.name || "Super Admin",
    email: overrides.email || "super@platform.test",
    password: overrides.password || "Super@12345",
    role: overrides.role || PLATFORM_ROLES.PLATFORM_SUPER_ADMIN,
    status: overrides.status || PLATFORM_ADMIN_STATUSES.ACTIVE
  });

const loginPlatform = async (email = "super@platform.test", password = "Super@12345") => {
  const res = await request(app).post("/api/platform/auth/login").send({ email, password });
  return res.body.data.token;
};

describe("Phase 6 tenant provisioning", () => {
  let sendEmailSpy;

  beforeEach(() => {
    sendEmailSpy = jest
      .spyOn(notificationManager, "sendEmail")
      .mockResolvedValue({ success: true, provider: "MOCK" });
  });

  afterEach(() => {
    sendEmailSpy.mockRestore();
  });

  test("authorized platform admin provisions tenant end-to-end", async () => {
    await createPlatformAdmin();
    const token = await loginPlatform();

    const res = await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(token))
      .send({
        tenant: { name: "ABC Technologies", slug: "abc" },
        admin: { name: "John Doe", email: "john@abc.com" }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(PROVISIONING_STATUSES.READY);
    expect(res.body.data.workspaceUrl).toBe("https://abc.elvasupport.in");
    expect(res.body.data.steps.tenantCreated.status).toBe(PROVISIONING_STEP_STATUSES.COMPLETED);
    expect(res.body.data.steps.adminCreated.status).toBe(PROVISIONING_STEP_STATUSES.COMPLETED);
    expect(res.body.data.steps.invitationCreated.status).toBe(PROVISIONING_STEP_STATUSES.COMPLETED);
    expect(res.body.data.steps.welcomeEmail.status).toBe(PROVISIONING_STEP_STATUSES.COMPLETED);

    const tenant = await Tenant.findOne({ slug: "abc" });
    expect(tenant).toBeTruthy();

    const admin = await User.findOne({ email: "john@abc.com", tenantId: tenant._id }).select(
      "+password"
    );
    expect(admin).toBeTruthy();
    expect(admin.role).toBe(ROLES.ADMIN);
    expect(admin.isActive).toBe(false);
    expect(admin.tenantId.toString()).toBe(tenant._id.toString());

    const invitation = await TenantAdminInvitation.findOne({ userId: admin._id }).select(
      "+tokenHash"
    );
    expect(invitation.status).toBe(INVITATION_STATUSES.PENDING);
    expect(invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    // Invited admin cannot login before setup
    const denied = await request(app)
      .post("/api/auth/login")
      .set("X-Tenant-Slug", "abc")
      .send({ email: "john@abc.com", password: "Anything@123" });
    expect(denied.status).toBe(401);

    expect(sendEmailSpy).toHaveBeenCalled();
    const html = sendEmailSpy.mock.calls[0][0].html;
    expect(html).toContain("abc.elvasupport.in");
    expect(html).not.toMatch(/tokenHash/i);

    const actions = (await PlatformAuditLog.find({}).lean()).map((a) => a.action);
    expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.TENANT_PROVISIONING_STARTED);
    expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.TENANT_PROVISIONING_COMPLETED);
    expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.TENANT_ADMIN_CREATED);
  });

  test("duplicate slug / provisioning is rejected without duplicates", async () => {
    await createPlatformAdmin();
    const token = await loginPlatform();

    const first = await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(token))
      .send({
        tenant: { name: "XYZ", slug: "xyz" },
        admin: { name: "Jane", email: "jane@xyz.com" }
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(token))
      .send({
        tenant: { name: "XYZ 2", slug: "xyz" },
        admin: { name: "Jane", email: "jane2@xyz.com" }
      });
    expect(second.status).toBe(409);

    expect(await Tenant.countDocuments({ slug: "xyz" })).toBe(1);
    expect(await User.countDocuments({ email: "jane@xyz.com" })).toBe(1);
  });

  test("invitation validate, expire, accept, and reject reuse", async () => {
    await createPlatformAdmin();
    const token = await loginPlatform();

    await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(token))
      .send({
        tenant: { name: "Inv Co", slug: "inv-co" },
        admin: { name: "Inv Admin", email: "inv@inv-co.com" }
      });

    const invitation = await TenantAdminInvitation.findOne({ email: "inv@inv-co.com" }).select(
      "+tokenHash"
    );

    // Craft known raw token by replacing invitation
    const { rawToken, tokenHash } = generateInvitationToken();
    invitation.tokenHash = tokenHash;
    invitation.expiresAt = getInvitationExpiryDate();
    invitation.status = INVITATION_STATUSES.PENDING;
    await invitation.save();

    const valid = await request(app).get(`/api/onboarding/invitation/${rawToken}`);
    expect(valid.status).toBe(200);
    expect(valid.body.data.valid).toBe(true);
    expect(valid.body.data.tenantSlug).toBe("inv-co");
    expect(valid.body.data).not.toHaveProperty("tokenHash");

    const bad = await request(app).get(`/api/onboarding/invitation/${"a".repeat(64)}`);
    expect(bad.body.data.valid).toBe(false);

    const setup = await request(app).post("/api/onboarding/complete-setup").send({
      token: rawToken,
      password: "NewPass@12345"
    });
    expect(setup.status).toBe(200);

    const user = await User.findOne({ email: "inv@inv-co.com" }).select("+password");
    expect(user.isActive).toBe(true);
    expect(await user.comparePassword("NewPass@12345")).toBe(true);

    const reused = await request(app).post("/api/onboarding/complete-setup").send({
      token: rawToken,
      password: "NewPass@12345"
    });
    expect(reused.status).toBe(400);

    // Login works in tenant context
    const login = await request(app)
      .post("/api/auth/login")
      .set("X-Tenant-Slug", "inv-co")
      .send({ email: "inv@inv-co.com", password: "NewPass@12345" });
    expect(login.status).toBe(200);

    // Expired invitation
    const { rawToken: expRaw, tokenHash: expHash } = generateInvitationToken();
    await TenantAdminInvitation.create({
      tenantId: user.tenantId,
      userId: user._id,
      email: user.email,
      tokenHash: expHash,
      status: INVITATION_STATUSES.PENDING,
      expiresAt: new Date(Date.now() - 1000)
    });
    // User already active — validate returns invalid; test expired path with inactive user
    user.isActive = false;
    await user.save();
    const expired = await request(app).get(`/api/onboarding/invitation/${expRaw}`);
    expect(expired.body.data.valid).toBe(false);
  });

  test("email failure keeps tenant/admin/invitation; resend works", async () => {
    sendEmailSpy.mockResolvedValueOnce({ success: false, error: "SMTP down" });

    await createPlatformAdmin();
    const token = await loginPlatform();

    const res = await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(token))
      .send({
        tenant: { name: "Mail Fail Co", slug: "mail-fail" },
        admin: { name: "Mail Admin", email: "mail@fail.com" }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(PROVISIONING_STATUSES.READY);
    expect(res.body.data.steps.welcomeEmail.status).toBe(PROVISIONING_STEP_STATUSES.FAILED);
    expect(await Tenant.findOne({ slug: "mail-fail" })).toBeTruthy();
    expect(await User.findOne({ email: "mail@fail.com" })).toBeTruthy();
    expect(await TenantAdminInvitation.countDocuments({ email: "mail@fail.com" })).toBe(1);

    sendEmailSpy.mockResolvedValue({ success: true, provider: "MOCK" });

    const resent = await request(app)
      .post(`/api/platform/provisionings/${res.body.data.id}/resend-invitation`)
      .set(authHeader(token));
    expect(resent.status).toBe(200);
    expect(resent.body.data.steps.welcomeEmail.status).toBe(PROVISIONING_STEP_STATUSES.COMPLETED);
    // Previous pending revoked; one new pending
    expect(
      await TenantAdminInvitation.countDocuments({
        email: "mail@fail.com",
        status: INVITATION_STATUSES.PENDING
      })
    ).toBe(1);
    expect(await User.countDocuments({ email: "mail@fail.com" })).toBe(1);
  });

  test("authorization: tenant JWT and PLATFORM_SUPPORT cannot provision", async () => {
    await seedTestData();
    const tenantToken = await loginAgent(app, "admin@test.com", "Admin@12345");

    const denied = await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(tenantToken))
      .send({
        tenant: { name: "Nope", slug: "nope" },
        admin: { name: "N", email: "n@nope.com" }
      });
    expect(denied.status).toBe(401);

    await createPlatformAdmin({
      email: "support@platform.test",
      role: PLATFORM_ROLES.PLATFORM_SUPPORT
    });
    const supportLogin = await request(app)
      .post("/api/platform/auth/login")
      .send({ email: "support@platform.test", password: "Super@12345" });
    const supportDenied = await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(supportLogin.body.data.token))
      .send({
        tenant: { name: "Nope2", slug: "nope2" },
        admin: { name: "N", email: "n@nope2.com" }
      });
    expect(supportDenied.status).toBe(403);

    await createPlatformAdmin({ email: "ops@platform.test", role: PLATFORM_ROLES.PLATFORM_ADMIN });
    const opsLogin = await request(app)
      .post("/api/platform/auth/login")
      .send({ email: "ops@platform.test", password: "Super@12345" });
    const allowed = await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(opsLogin.body.data.token))
      .send({
        tenant: { name: "Ops Co", slug: "ops-co" },
        admin: { name: "Ops Admin", email: "ops@ops-co.com" }
      });
    expect(allowed.status).toBe(201);
  });

  test("tenant-scoped user email uniqueness and tenant-aware login", async () => {
    await seedTestData();

    const tenantB = await Tenant.create({
      name: "Other",
      slug: "other",
      status: "ACTIVE"
    });

    await User.create({
      tenantId: tenantB._id,
      email: "admin@test.com",
      password: "Other@12345",
      firstName: "Other",
      lastName: "Admin",
      role: ROLES.ADMIN,
      isActive: true
    });

    // Same email allowed across tenants
    expect(await User.countDocuments({ email: "admin@test.com" })).toBe(2);

    // Same email same tenant rejected
    await expect(
      User.create({
        tenantId: tenantB._id,
        email: "admin@test.com",
        password: "Dup@12345",
        firstName: "Dup",
        lastName: "User",
        role: ROLES.AGENT,
        isActive: true
      })
    ).rejects.toMatchObject({ code: 11000 });

    const elvaLogin = await request(app)
      .post("/api/auth/login")
      .set("X-Tenant-Slug", "elva")
      .send({ email: "admin@test.com", password: "Admin@12345" });
    expect(elvaLogin.status).toBe(200);

    const otherLogin = await request(app)
      .post("/api/auth/login")
      .set("X-Tenant-Slug", "other")
      .send({ email: "admin@test.com", password: "Other@12345" });
    expect(otherLogin.status).toBe(200);

    // Wrong password for tenant
    const wrong = await request(app)
      .post("/api/auth/login")
      .set("X-Tenant-Slug", "elva")
      .send({ email: "admin@test.com", password: "Other@12345" });
    expect(wrong.status).toBe(401);
  });

  test("new tenant admin cannot access another tenant; ELVA still works", async () => {
    await createPlatformAdmin();
    const platformToken = await loginPlatform();

    await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(platformToken))
      .send({
        tenant: { name: "Iso Co", slug: "iso-co" },
        admin: { name: "Iso Admin", email: "iso@iso-co.com" }
      });

    const invitation = await TenantAdminInvitation.findOne({ email: "iso@iso-co.com" }).select(
      "+tokenHash"
    );
    const { rawToken, tokenHash } = generateInvitationToken();
    invitation.tokenHash = tokenHash;
    await invitation.save();

    await request(app).post("/api/onboarding/complete-setup").send({
      token: rawToken,
      password: "IsoPass@12345"
    });

    const isoToken = await loginAgent(app, "iso@iso-co.com", "IsoPass@12345", {
      tenantSlug: "iso-co"
    });

    const seeded = await seedTestData();
    // Cross-tenant: iso admin hitting elva apps
    const cross = await request(app)
      .get("/api/applications")
      .set(authHeader(isoToken))
      .set("X-Tenant-Slug", "elva");
    expect(cross.status).toBe(403);

    const elvaToken = await loginAgent(app, "admin@test.com", "Admin@12345");
    const elvaOk = await request(app)
      .get("/api/applications")
      .set(authHeader(elvaToken))
      .set("X-Tenant-Slug", "elva");
    expect(elvaOk.status).toBe(200);
    expect(seeded.tenant.slug).toBe("elva");
  });

  test("list provisionings and retry email step", async () => {
    sendEmailSpy.mockResolvedValueOnce({ success: false, error: "fail" });
    await createPlatformAdmin();
    const token = await loginPlatform();

    const created = await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(token))
      .send({
        tenant: { name: "Retry Co", slug: "retry-co" },
        admin: { name: "Retry Admin", email: "retry@retry-co.com" }
      });

    sendEmailSpy.mockResolvedValue({ success: true });

    const retried = await request(app)
      .post(`/api/platform/provisionings/${created.body.data.id}/retry`)
      .set(authHeader(token));
    expect(retried.status).toBe(200);
    expect(retried.body.data.steps.welcomeEmail.status).toBe(PROVISIONING_STEP_STATUSES.COMPLETED);
    expect(await Tenant.countDocuments({ slug: "retry-co" })).toBe(1);
    expect(await User.countDocuments({ email: "retry@retry-co.com" })).toBe(1);

    const listed = await request(app)
      .get("/api/platform/provisionings?search=retry")
      .set(authHeader(token));
    expect(listed.status).toBe(200);
    expect(listed.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  test("raw invitation token is never stored", async () => {
    await createPlatformAdmin();
    const token = await loginPlatform();
    await request(app)
      .post("/api/platform/tenants/provision")
      .set(authHeader(token))
      .send({
        tenant: { name: "Hash Co", slug: "hash-co" },
        admin: { name: "Hash Admin", email: "hash@hash-co.com" }
      });

    const inv = await TenantAdminInvitation.findOne({ email: "hash@hash-co.com" }).select(
      "+tokenHash"
    );
    expect(inv.tokenHash).toHaveLength(64);
    // Email contains a token query param that hashes to something else if we extract it
    const callHtml = sendEmailSpy.mock.calls[0][0].html;
    const match = callHtml.match(/token=([a-f0-9]+)/);
    expect(match).toBeTruthy();
    expect(hashInvitationToken(match[1])).toBe(inv.tokenHash);
    expect(inv.tokenHash).not.toBe(match[1]);
  });
});
