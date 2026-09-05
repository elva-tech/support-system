const request = require("supertest");
const app = require("../../src/app");
const PlatformAdmin = require("../../src/modules/platform-admin/platform-admin.model");
const PlatformAuditLog = require("../../src/modules/platform-admin/platform-audit-log.model");
const Tenant = require("../../src/modules/tenants/tenant.model");
const {
  PLATFORM_ROLES,
  PLATFORM_ADMIN_STATUSES,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_IDENTITY_TYPE
} = require("../../src/shared/constants/platform");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { seedTestData, loginAgent } = require("../helpers/seed");
const platformAuthService = require("../../src/modules/platform-admin/platform-auth.service");
const platformAdminService = require("../../src/modules/platform-admin/platform-admin.service");

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const createPlatformAdmin = async (overrides = {}) => {
  const admin = await PlatformAdmin.create({
    name: overrides.name || "Super Admin",
    email: overrides.email || "super@platform.test",
    password: overrides.password || "Super@12345",
    role: overrides.role || PLATFORM_ROLES.PLATFORM_SUPER_ADMIN,
    status: overrides.status || PLATFORM_ADMIN_STATUSES.ACTIVE
  });
  return admin;
};

const loginPlatform = async (email, password) => {
  const res = await request(app).post("/api/platform/auth/login").send({ email, password });
  return res;
};

describe("Phase 5 platform administration", () => {
  describe("platform authentication", () => {
    test("valid login succeeds; password never returned", async () => {
      await createPlatformAdmin();
      const res = await loginPlatform("super@platform.test", "Super@12345");
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.admin.email).toBe("super@platform.test");
      expect(res.body.data.admin.password).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);

      const me = await request(app)
        .get("/api/platform/auth/me")
        .set(authHeader(res.body.data.token));
      expect(me.status).toBe(200);
      expect(me.body.data.role).toBe(PLATFORM_ROLES.PLATFORM_SUPER_ADMIN);
    });

    test("invalid password and unknown email both return generic denial", async () => {
      await createPlatformAdmin();
      const badPw = await loginPlatform("super@platform.test", "wrong-password");
      expect(badPw.status).toBe(401);
      expect(badPw.body.message).toMatch(/invalid email or password/i);

      const unknown = await loginPlatform("nobody@platform.test", "whatever");
      expect(unknown.status).toBe(401);
      expect(unknown.body.message).toMatch(/invalid email or password/i);
    });

    test("suspended and disabled admins cannot authenticate", async () => {
      await createPlatformAdmin({
        email: "sus@platform.test",
        status: PLATFORM_ADMIN_STATUSES.SUSPENDED
      });
      await createPlatformAdmin({
        email: "dis@platform.test",
        status: PLATFORM_ADMIN_STATUSES.DISABLED
      });

      const sus = await loginPlatform("sus@platform.test", "Super@12345");
      expect(sus.status).toBe(403);

      const dis = await loginPlatform("dis@platform.test", "Super@12345");
      expect(dis.status).toBe(403);
    });
  });

  describe("token separation", () => {
    test("tenant JWT cannot access platform APIs; platform JWT cannot access tenant staff APIs", async () => {
      const seeded = await seedTestData();
      const tenantToken = await loginAgent(app, "admin@test.com", "Admin@12345");

      const platformDenied = await request(app)
        .get("/api/platform/tenants")
        .set(authHeader(tenantToken));
      expect(platformDenied.status).toBe(401);

      await createPlatformAdmin();
      const login = await loginPlatform("super@platform.test", "Super@12345");
      const platformToken = login.body.data.token;

      const tenantDenied = await request(app)
        .get("/api/users")
        .set(authHeader(platformToken))
        .set("X-Tenant-Slug", "elva");
      expect(tenantDenied.status).toBe(401);

      // Platform JWT must carry identityType
      const jwt = require("jsonwebtoken");
      const env = require("../../src/config/env");
      const decoded = jwt.verify(platformToken, env.jwtSecret);
      expect(decoded.identityType).toBe(PLATFORM_IDENTITY_TYPE);

      // Tenant JWT must not
      const tenantDecoded = jwt.verify(tenantToken, env.jwtSecret);
      expect(tenantDecoded.identityType).toBeUndefined();
      expect(seeded.admin.role).toBe("ADMIN");
    });
  });

  describe("platform authorization & admin management", () => {
    test("super admin manages tenants and admins; support is restricted; admin cannot create super", async () => {
      const superAdmin = await createPlatformAdmin();
      const superLogin = await loginPlatform("super@platform.test", "Super@12345");
      const superToken = superLogin.body.data.token;

      const createOp = await request(app)
        .post("/api/platform/admins")
        .set(authHeader(superToken))
        .send({
          name: "Ops Admin",
          email: "ops@platform.test",
          password: "OpsAdmin@123",
          role: PLATFORM_ROLES.PLATFORM_ADMIN
        });
      expect(createOp.status).toBe(201);

      const createSupport = await request(app)
        .post("/api/platform/admins")
        .set(authHeader(superToken))
        .send({
          name: "Support",
          email: "support@platform.test",
          password: "Support@123",
          role: PLATFORM_ROLES.PLATFORM_SUPPORT
        });
      expect(createSupport.status).toBe(201);

      const opsLogin = await loginPlatform("ops@platform.test", "OpsAdmin@123");
      const opsToken = opsLogin.body.data.token;

      const supportLogin = await loginPlatform("support@platform.test", "Support@123");
      const supportToken = supportLogin.body.data.token;

      // PLATFORM_ADMIN cannot create SUPER_ADMIN
      const promote = await request(app)
        .post("/api/platform/admins")
        .set(authHeader(opsToken))
        .send({
          name: "Hacker",
          email: "hacker@platform.test",
          password: "Hacker@12345",
          role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN
        });
      expect(promote.status).toBe(403);

      // PLATFORM_SUPPORT cannot manage admins
      const supportCreate = await request(app)
        .post("/api/platform/admins")
        .set(authHeader(supportToken))
        .send({
          name: "X",
          email: "x@platform.test",
          password: "Xxxxxx@123",
          role: PLATFORM_ROLES.PLATFORM_ADMIN
        });
      expect(supportCreate.status).toBe(403);

      // PLATFORM_SUPPORT can list tenants (read)
      const listAsSupport = await request(app)
        .get("/api/platform/tenants")
        .set(authHeader(supportToken));
      expect(listAsSupport.status).toBe(200);

      // PLATFORM_SUPPORT cannot create tenants
      const createAsSupport = await request(app)
        .post("/api/platform/tenants")
        .set(authHeader(supportToken))
        .send({ name: "Nope", slug: "nope-co" });
      expect(createAsSupport.status).toBe(403);

      // PLATFORM_ADMIN can create tenants
      const tenantRes = await request(app)
        .post("/api/platform/tenants")
        .set(authHeader(opsToken))
        .send({ name: "ABC Software", slug: "abc" });
      expect(tenantRes.status).toBe(201);
      expect(tenantRes.body.data.slug).toBe("abc");

      expect(superAdmin.email).toBe("super@platform.test");
    });

    test("last active super admin cannot be disabled or demoted", async () => {
      const only = await createPlatformAdmin({ email: "only@platform.test" });
      const login = await loginPlatform("only@platform.test", "Super@12345");
      const token = login.body.data.token;

      const disable = await request(app)
        .patch(`/api/platform/admins/${only._id}`)
        .set(authHeader(token))
        .send({ status: PLATFORM_ADMIN_STATUSES.DISABLED });
      expect(disable.status).toBe(400);
      expect(disable.body.errors?.code).toBe("LAST_SUPER_ADMIN_PROTECTED");

      const demote = await request(app)
        .patch(`/api/platform/admins/${only._id}`)
        .set(authHeader(token))
        .send({ role: PLATFORM_ROLES.PLATFORM_ADMIN });
      expect(demote.status).toBe(400);
      expect(demote.body.errors?.code).toBe("LAST_SUPER_ADMIN_PROTECTED");
    });
  });

  describe("tenant management & lifecycle", () => {
    test("create, list, get, update; slug immutable; lifecycle; no physical delete", async () => {
      await createPlatformAdmin();
      const login = await loginPlatform("super@platform.test", "Super@12345");
      const token = login.body.data.token;

      const created = await request(app)
        .post("/api/platform/tenants")
        .set(authHeader(token))
        .send({
          name: "XYZ Corp",
          slug: "xyz",
          settings: { organization: { region: "IN" } }
        });
      expect(created.status).toBe(201);
      const tenantId = created.body.data.id;

      const dup = await request(app)
        .post("/api/platform/tenants")
        .set(authHeader(token))
        .send({ name: "Dup", slug: "xyz" });
      expect(dup.status).toBe(409);

      const reserved = await request(app)
        .post("/api/platform/tenants")
        .set(authHeader(token))
        .send({ name: "Admin Co", slug: "admin" });
      expect(reserved.status).toBe(400);

      const listed = await request(app)
        .get("/api/platform/tenants?search=xyz")
        .set(authHeader(token));
      expect(listed.status).toBe(200);
      expect(listed.body.data.items.some((t) => t.slug === "xyz")).toBe(true);

      const detail = await request(app)
        .get(`/api/platform/tenants/${tenantId}`)
        .set(authHeader(token));
      expect(detail.status).toBe(200);
      expect(detail.body.data.name).toBe("XYZ Corp");

      const updated = await request(app)
        .patch(`/api/platform/tenants/${tenantId}`)
        .set(authHeader(token))
        .send({
          name: "XYZ Corporation",
          settings: { branding: { primaryColor: "#123456" } },
          slug: "renamed"
        });
      expect(updated.status).toBe(400);

      const updatedOk = await request(app)
        .patch(`/api/platform/tenants/${tenantId}`)
        .set(authHeader(token))
        .send({
          name: "XYZ Corporation",
          settings: { branding: { primaryColor: "#123456" } }
        });
      expect(updatedOk.status).toBe(200);
      expect(updatedOk.body.data.slug).toBe("xyz");
      expect(updatedOk.body.data.name).toBe("XYZ Corporation");

      const suspended = await request(app)
        .post(`/api/platform/tenants/${tenantId}/suspend`)
        .set(authHeader(token));
      expect(suspended.status).toBe(200);
      expect(suspended.body.data.status).toBe(TENANT_STATUSES.SUSPENDED);

      const activated = await request(app)
        .post(`/api/platform/tenants/${tenantId}/activate`)
        .set(authHeader(token));
      expect(activated.status).toBe(200);
      expect(activated.body.data.status).toBe(TENANT_STATUSES.ACTIVE);

      // Archive from ACTIVE is invalid — must cancel first
      const archiveBad = await request(app)
        .post(`/api/platform/tenants/${tenantId}/archive`)
        .set(authHeader(token));
      expect(archiveBad.status).toBe(400);

      await request(app)
        .post(`/api/platform/tenants/${tenantId}/cancel`)
        .set(authHeader(token));

      const archived = await request(app)
        .post(`/api/platform/tenants/${tenantId}/archive`)
        .set(authHeader(token));
      expect(archived.status).toBe(200);
      expect(archived.body.data.status).toBe(TENANT_STATUSES.ARCHIVED);

      // Still present in DB (no physical delete)
      const stillThere = await Tenant.findById(tenantId);
      expect(stillThere).toBeTruthy();
      expect(stillThere.status).toBe(TENANT_STATUSES.ARCHIVED);

      // Terminal — cannot activate archived
      const revive = await request(app)
        .post(`/api/platform/tenants/${tenantId}/activate`)
        .set(authHeader(token));
      expect(revive.status).toBe(400);
    });
  });

  describe("platform audit", () => {
    test("tenant create/suspend and admin create produce audit events", async () => {
      await createPlatformAdmin();
      const login = await loginPlatform("super@platform.test", "Super@12345");
      const token = login.body.data.token;

      await request(app)
        .post("/api/platform/tenants")
        .set(authHeader(token))
        .send({ name: "Audit Co", slug: "audit-co" });

      const tenant = await Tenant.findOne({ slug: "audit-co" });
      await request(app)
        .post(`/api/platform/tenants/${tenant._id}/suspend`)
        .set(authHeader(token));

      await request(app)
        .post("/api/platform/admins")
        .set(authHeader(token))
        .send({
          name: "Audited Admin",
          email: "audited@platform.test",
          password: "Audited@123",
          role: PLATFORM_ROLES.PLATFORM_ADMIN
        });

      const actions = (await PlatformAuditLog.find({}).lean()).map((a) => a.action);
      expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.TENANT_CREATED);
      expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.TENANT_SUSPENDED);
      expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.PLATFORM_ADMIN_CREATED);
      expect(actions).toContain(PLATFORM_AUDIT_ACTIONS.PLATFORM_ADMIN_LOGIN);

      const auditApi = await request(app).get("/api/platform/audit").set(authHeader(token));
      expect(auditApi.status).toBe(200);
      expect(auditApi.body.data.total).toBeGreaterThan(0);
    });
  });

  describe("bootstrap", () => {
    test("ensureBootstrapSuperAdmin is idempotent", async () => {
      const first = await platformAdminService.ensureBootstrapSuperAdmin({
        name: "Boot",
        email: "boot@platform.test",
        password: "Boot@12345"
      });
      expect(first.created).toBe(true);

      const second = await platformAdminService.ensureBootstrapSuperAdmin({
        name: "Boot",
        email: "boot@platform.test",
        password: "Boot@12345"
      });
      expect(second.created).toBe(false);

      const count = await PlatformAdmin.countDocuments({ email: "boot@platform.test" });
      expect(count).toBe(1);

      const token = platformAuthService.signPlatformToken(
        await PlatformAdmin.findOne({ email: "boot@platform.test" })
      );
      expect(token).toBeTruthy();
    });
  });
});
