const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../src/app");
const Tenant = require("../../src/modules/tenants/tenant.model");
const User = require("../../src/modules/users/user.model");
const { ROLES } = require("../../src/shared/constants/roles");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { loginAgent } = require("../helpers/seed");

const tenantHeaders = (token, slug) => ({
  Authorization: `Bearer ${token}`,
  "X-Tenant-Slug": slug
});

const createTenantWorkspace = async ({ slug, name }) => {
  const tenant = await Tenant.create({
    name,
    slug,
    status: TENANT_STATUSES.ACTIVE,
    settings: { organization: { displayName: name }, branding: {}, notifications: {} }
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

describe("platform support + collaborate", () => {
  test("tenant staff creates ticket; spoofed tenant/email ignored", async () => {
    const { admin, tenant } = await createTenantWorkspace({
      slug: "sup-co",
      name: "Support Co"
    });
    const token = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "sup-co" });

    const res = await request(app)
      .post("/api/platform-support/tickets")
      .set(tenantHeaders(token, "sup-co"))
      .send({
        category: "TECHNICAL_ISSUE",
        subject: "Cannot configure mail",
        description: "Inbound mail fails",
        priority: "HIGH",
        sourceTenantId: new mongoose.Types.ObjectId().toString(),
        raisedByEmail: "attacker@evil.com"
      });

    expect(res.status).toBe(201);
    expect(res.body.data.ticketNumber).toMatch(/^ELVA-\d+$/);
    expect(res.body.data.sourceTenantSlug).toBe("sup-co");
    expect(res.body.data.raisedByEmail).toBe(admin.email.toLowerCase());
    expect(res.body.data.sourceTenantId).toBe(String(tenant._id));
    expect(res.body.data.sla?.currentCycle?.responseTargetMinutes).toBeTruthy();
  });

  test("agent cannot view another user's ticket; admin can", async () => {
    const { admin, tenant } = await createTenantWorkspace({
      slug: "view-co",
      name: "View Co"
    });
    const adminToken = await loginAgent(app, admin.email, "Admin@12345", { tenantSlug: "view-co" });

    const agent = await User.create({
      tenantId: tenant._id,
      email: "agent@view-co.test",
      password: "Agent@12345",
      firstName: "Ag",
      lastName: "Ent",
      role: ROLES.AGENT,
      isActive: true
    });
    const agentToken = await loginAgent(app, agent.email, "Agent@12345", { tenantSlug: "view-co" });

    const created = await request(app)
      .post("/api/platform-support/tickets")
      .set(tenantHeaders(adminToken, "view-co"))
      .send({
        category: "OTHER",
        subject: "Admin only ticket",
        description: "Should not be visible to agent"
      });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const agentGet = await request(app)
      .get(`/api/platform-support/tickets/${id}`)
      .set(tenantHeaders(agentToken, "view-co"));
    expect([403, 404]).toContain(agentGet.status);

    const adminGet = await request(app)
      .get(`/api/platform-support/tickets/${id}`)
      .set(tenantHeaders(adminToken, "view-co"));
    expect(adminGet.status).toBe(200);
  });

  test("public collaborate enquiry persists", async () => {
    const res = await request(app).post("/api/public/enquiries").send({
      organizationName: "New Biz",
      contactPerson: "Pat",
      businessEmail: "pat@newbiz.test",
      message: "We want a workspace"
    });
    expect(res.status).toBe(201);
    expect(res.body.data.organizationName).toBe("New Biz");
  });
});
