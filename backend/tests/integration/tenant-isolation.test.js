const request = require("supertest");
const app = require("../../src/app");
const Tenant = require("../../src/modules/tenants/tenant.model");
const Application = require("../../src/modules/applications/application.model");
const Team = require("../../src/modules/teams/team.model");
const User = require("../../src/modules/users/user.model");
const MerchantProfile = require("../../src/modules/merchants/merchant-profile.model");
const Ticket = require("../../src/modules/tickets/ticket.model");
const Module = require("../../src/modules/modules/module.model");
const { generateTicketNumber } = require("../../src/modules/tickets/ticket-number.service");
const { ROLES } = require("../../src/shared/constants/roles");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { seedTestData, loginAgent } = require("../helpers/seed");
const {
  resolveTenantSlugCandidate,
  resolveTenantFromRequest
} = require("../../src/modules/tenants/tenant-resolver.service");

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

describe("Phase 4 tenant context & isolation", () => {
  test("development header override resolves tenant; reserved host rejected", async () => {
    await Tenant.create({
      name: "ELVA Technologies",
      slug: "elva",
      status: TENANT_STATUSES.ACTIVE
    });

    const headerReq = { headers: { "x-tenant-slug": "ELVA", host: "localhost:3000" } };
    const candidate = resolveTenantSlugCandidate(headerReq);
    expect(candidate).toEqual({ source: "header", slug: "elva" });

    const resolved = await resolveTenantFromRequest(headerReq, { required: true });
    expect(resolved.slug).toBe("elva");

    const hostReq = {
      headers: { host: "abc.elvasupport.in" }
    };
    // no abc tenant yet → not found
    await expect(resolveTenantFromRequest(hostReq, { required: true })).rejects.toMatchObject({
      statusCode: 404
    });

    expect(() =>
      resolveTenantSlugCandidate({ headers: { host: "admin.elvasupport.in" } })
    ).toThrow(/reserved/i);
  });

  test("inactive tenants are denied", async () => {
    await Tenant.create({
      name: "Suspended Co",
      slug: "suspended-co",
      status: TENANT_STATUSES.SUSPENDED
    });

    await expect(
      resolveTenantFromRequest(
        { headers: { "x-tenant-slug": "suspended-co", host: "localhost" } },
        { required: true }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      errors: { code: "TENANT_INACTIVE" }
    });
  });

  test("staff membership mismatch is denied; matching tenant can access own ticket only", async () => {
    const seeded = await seedTestData();

    const tenantB = await Tenant.create({
      name: "Other Co",
      slug: "other-co",
      status: TENANT_STATUSES.ACTIVE
    });

    const appB = await Application.create({
      tenantId: tenantB._id,
      name: "Other App",
      code: "ERP",
      isActive: true
    });

    const teamB = await Team.create({
      tenantId: tenantB._id,
      name: "Other Team",
      applicationId: appB._id,
      isActive: true
    });

    const adminB = await User.create({
      tenantId: tenantB._id,
      email: "admin-b@other.com",
      password: "Admin@12345",
      firstName: "Admin",
      lastName: "B",
      role: ROLES.ADMIN,
      isActive: true
    });

    const moduleB = await Module.create({
      name: "Core",
      code: "CORE",
      applicationId: appB._id,
      defaultTeamId: teamB._id,
      isActive: true
    });

    const merchantB = await MerchantProfile.create({
      tenantId: tenantB._id,
      applicationId: appB._id,
      applicationCode: "ERP",
      externalUserId: "m-b",
      merchantName: "Merchant B",
      email: "merchant@test.com",
      isActive: true
    });

    const ticketB = await Ticket.create({
      tenantId: tenantB._id,
      ticketNumber: "ERP-2026-000001",
      applicationId: appB._id,
      applicationCode: "ERP",
      moduleId: moduleB._id,
      merchantId: merchantB._id,
      teamId: teamB._id,
      subject: "Other tenant ticket",
      description: "Secret",
      status: "OPEN"
    });

    const tokenA = await loginAgent(app, "admin@test.com", "Admin@12345");
    const tokenB = await loginAgent(app, "admin-b@other.com", "Admin@12345");

    // A cannot read B's ticket even with ObjectId
    const denied = await request(app)
      .get(`/api/tickets/${ticketB._id}`)
      .set(authHeader(tokenA))
      .set("X-Tenant-Slug", "elva");
    expect(denied.status).toBe(404);

    // B can read own ticket with own tenant header
    const ok = await request(app)
      .get(`/api/tickets/${ticketB._id}`)
      .set(authHeader(tokenB))
      .set("X-Tenant-Slug", "other-co");
    expect(ok.status).toBe(200);
    expect(ok.body.data.ticketNumber).toBe("ERP-2026-000001");

    // B token against elva tenant → membership denied
    const crossMembership = await request(app)
      .get("/api/applications")
      .set(authHeader(tokenB))
      .set("X-Tenant-Slug", "elva");
    expect(crossMembership.status).toBe(403);
    expect(crossMembership.body.errors?.code || crossMembership.body.message).toBeTruthy();

    // A cannot list B application by id
    const appDenied = await request(app)
      .get(`/api/applications/${appB._id}`)
      .set(authHeader(tokenA))
      .set("X-Tenant-Slug", "elva");
    expect(appDenied.status).toBe(404);

    // Client-supplied tenantId on create is ignored (server uses req.tenant)
    const created = await request(app)
      .post("/api/applications")
      .set(authHeader(tokenA))
      .set("X-Tenant-Slug", "elva")
      .send({
        name: "Forged",
        code: "FRG",
        tenantId: tenantB._id.toString(),
        isActive: true
      });
    expect(created.status).toBe(201);
    expect(String(created.body.data.tenantId)).toBe(String(seeded.tenantId));

    // Same application code allowed in different tenants
    const erpA = await request(app)
      .post("/api/applications")
      .set(authHeader(tokenA))
      .set("X-Tenant-Slug", "elva")
      .send({ name: "ELVA ERP", code: "ERP", isActive: true });
    expect(erpA.status).toBe(201);

    // Duplicate ERP in same tenant denied
    const erpDup = await request(app)
      .post("/api/applications")
      .set(authHeader(tokenA))
      .set("X-Tenant-Slug", "elva")
      .send({ name: "ELVA ERP 2", code: "ERP", isActive: true });
    expect(erpDup.status).toBe(409);

    void adminB;
  });

  test("ticket sequences are independent per tenant for same application code", async () => {
    const tenantA = await Tenant.create({
      name: "A",
      slug: "ten-a",
      status: TENANT_STATUSES.ACTIVE
    });
    const tenantB = await Tenant.create({
      name: "B",
      slug: "ten-b",
      status: TENANT_STATUSES.ACTIVE
    });

    const n1 = await generateTicketNumber("APP", tenantA._id);
    const n2 = await generateTicketNumber("APP", tenantA._id);
    const m1 = await generateTicketNumber("APP", tenantB._id);

    expect(n1).toBe("APP-2026-000001");
    expect(n2).toBe("APP-2026-000002");
    expect(m1).toBe("APP-2026-000001");
  });

  test("existing ELVA seed flows still work with default tenant slug", async () => {
    await seedTestData();
    const token = await loginAgent(app, "agent-a@test.com", "Agent@12345");

    const list = await request(app).get("/api/tickets").set(authHeader(token));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);

    const otp = await request(app)
      .post("/api/merchant/request-otp")
      .send({ email: "merchant@test.com" });
    expect(otp.status).toBe(200);
    expect(otp.body.sent).toBe(true);
  });
});
