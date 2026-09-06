const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../src/app");
const Tenant = require("../../src/modules/tenants/tenant.model");
const User = require("../../src/modules/users/user.model");
const PlatformAdmin = require("../../src/modules/platform-admin/platform-admin.model");
const CentralSupportUser = require("../../src/modules/central-support/central-support-user.model");
const CentralSupportTeam = require("../../src/modules/central-support/central-support-team.model");
const PlatformSupportTicket = require("../../src/modules/platform-support/platform-support-ticket.model");
const { ROLES } = require("../../src/shared/constants/roles");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { PLATFORM_ROLES, PLATFORM_ADMIN_STATUSES } = require("../../src/shared/constants/platform");
const {
  CENTRAL_SUPPORT_ROLES,
  CENTRAL_SUPPORT_USER_STATUSES
} = require("../../src/shared/constants/central-support");
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

const loginCentral = async (email, password) => {
  const res = await request(app).post("/api/central-support/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token;
};

describe("central support identity domain", () => {
  test("platform admin cannot use central-support APIs; CS admin can manage agents/teams", async () => {
    const platform = await PlatformAdmin.create({
      name: "Plat Admin",
      email: "plat@elva.test",
      password: "Platform@123",
      role: PLATFORM_ROLES.PLATFORM_SUPER_ADMIN,
      status: PLATFORM_ADMIN_STATUSES.ACTIVE
    });

    const platLogin = await request(app)
      .post("/api/platform/auth/login")
      .send({ email: platform.email, password: "Platform@123" });
    expect(platLogin.status).toBe(200);
    const platToken = platLogin.body.data.token;

    const blocked = await request(app)
      .get("/api/central-support/tickets")
      .set("Authorization", `Bearer ${platToken}`);
    expect(blocked.status).toBe(401);

    const gone = await request(app)
      .get("/api/platform/support-tickets")
      .set("Authorization", `Bearer ${platToken}`);
    expect(gone.status).toBe(410);

    const csAdmin = await CentralSupportUser.create({
      name: "CS Admin",
      email: "cs.admin@elva.test",
      password: "Central@12345",
      role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN,
      status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE
    });
    const csToken = await loginCentral(csAdmin.email, "Central@12345");

    const agentRes = await request(app)
      .post("/api/central-support/agents")
      .set("Authorization", `Bearer ${csToken}`)
      .send({
        name: "Alice Agent",
        email: "alice.agent@elva.test",
        password: "Agent@12345",
        role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_AGENT
      });
    expect(agentRes.status).toBe(201);
    expect(agentRes.body.data.role).toBe(CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_AGENT);

    const teamRes = await request(app)
      .post("/api/central-support/teams")
      .set("Authorization", `Bearer ${csToken}`)
      .send({
        name: "Technical Support",
        description: "Tech issues",
        teamLeadId: null,
        memberIds: [agentRes.body.data.id]
      });
    expect(teamRes.status).toBe(201);
    expect(teamRes.body.data.name).toBe("Technical Support");

    const assignees = await request(app)
      .get("/api/central-support/tickets/assignees")
      .set("Authorization", `Bearer ${csToken}`);
    expect(assignees.status).toBe(200);
    const emails = assignees.body.data.map((a) => a.email);
    expect(emails).toContain("alice.agent@elva.test");
    expect(emails).not.toContain("plat@elva.test");
  });

  test("only CS users can be assigned; platform admin id rejected", async () => {
    const { admin } = await createTenantWorkspace({ slug: "assign-co", name: "Assign Co" });
    const tenantToken = await loginAgent(app, admin.email, "Admin@12345", {
      tenantSlug: "assign-co"
    });

    const created = await request(app)
      .post("/api/platform-support/tickets")
      .set(tenantHeaders(tenantToken, "assign-co"))
      .send({
        category: "TECHNICAL_ISSUE",
        subject: "Need assignment",
        description: "Please assign to CS agent"
      });
    expect(created.status).toBe(201);
    const ticketId = created.body.data.id;

    const platform = await PlatformAdmin.create({
      name: "Bad Assignee",
      email: "bad.assign@elva.test",
      password: "Platform@123",
      role: PLATFORM_ROLES.PLATFORM_ADMIN,
      status: PLATFORM_ADMIN_STATUSES.ACTIVE
    });

    const csAdmin = await CentralSupportUser.create({
      name: "CS Boss",
      email: "cs.boss@elva.test",
      password: "Central@12345",
      role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN,
      status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE
    });
    const agent = await CentralSupportUser.create({
      name: "Bob Agent",
      email: "bob.agent@elva.test",
      password: "Agent@12345",
      role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_AGENT,
      status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE
    });
    const csToken = await loginCentral(csAdmin.email, "Central@12345");

    const badAssign = await request(app)
      .patch(`/api/central-support/tickets/${ticketId}/assign`)
      .set("Authorization", `Bearer ${csToken}`)
      .send({ assignedUserId: String(platform._id) });
    expect(badAssign.status).toBe(400);

    const goodAssign = await request(app)
      .patch(`/api/central-support/tickets/${ticketId}/assign`)
      .set("Authorization", `Bearer ${csToken}`)
      .send({ assignedUserId: String(agent._id) });
    expect(goodAssign.status).toBe(200);
    expect(goodAssign.body.data.assignedUserId).toBe(String(agent._id));
    expect(goodAssign.body.data.assignedUserName).toBe("Bob Agent");
  });

  test("agent sees assigned tickets; cannot manage settings/agents", async () => {
    const csAdmin = await CentralSupportUser.create({
      name: "CS Admin2",
      email: "cs.admin2@elva.test",
      password: "Central@12345",
      role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_ADMIN,
      status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE
    });
    const team = await CentralSupportTeam.create({
      name: "Ops Team",
      description: "",
      memberIds: [],
      isActive: true
    });
    const agent = await CentralSupportUser.create({
      name: "Carol",
      email: "carol.agent@elva.test",
      password: "Agent@12345",
      role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_AGENT,
      status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE,
      teamId: team._id
    });
    team.memberIds = [agent._id];
    await team.save();

    const { admin } = await createTenantWorkspace({ slug: "scope-co", name: "Scope Co" });
    const tenantToken = await loginAgent(app, admin.email, "Admin@12345", {
      tenantSlug: "scope-co"
    });
    const created = await request(app)
      .post("/api/platform-support/tickets")
      .set(tenantHeaders(tenantToken, "scope-co"))
      .send({
        category: "OTHER",
        subject: "Scoped ticket",
        description: "For Carol"
      });
    const ticketId = created.body.data.id;

    const adminToken = await loginCentral(csAdmin.email, "Central@12345");
    await request(app)
      .patch(`/api/central-support/tickets/${ticketId}/assign`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ assignedUserId: String(agent._id), assignedTeamId: String(team._id) });

    const agentToken = await loginCentral(agent.email, "Agent@12345");
    const mine = await request(app)
      .get("/api/central-support/tickets?mine=true")
      .set("Authorization", `Bearer ${agentToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.items.some((t) => t.id === ticketId)).toBe(true);

    const createAgent = await request(app)
      .post("/api/central-support/agents")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        name: "Nope",
        email: "nope@elva.test",
        password: "Agent@12345",
        role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_AGENT
      });
    expect(createAgent.status).toBe(403);
  });

  test("team lead scoped to team queue", async () => {
    const team = await CentralSupportTeam.create({
      name: "Lead Team",
      isActive: true,
      memberIds: []
    });
    const lead = await CentralSupportUser.create({
      name: "Lead",
      email: "lead@elva.test",
      password: "Lead@12345",
      role: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_TEAM_LEAD,
      status: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE,
      teamId: team._id
    });
    team.teamLeadId = lead._id;
    team.memberIds = [lead._id];
    await team.save();

    const otherTeam = await CentralSupportTeam.create({
      name: "Other Team",
      isActive: true,
      memberIds: []
    });

    const { admin } = await createTenantWorkspace({ slug: "lead-co", name: "Lead Co" });
    const tenantToken = await loginAgent(app, admin.email, "Admin@12345", {
      tenantSlug: "lead-co"
    });
    const a = await request(app)
      .post("/api/platform-support/tickets")
      .set(tenantHeaders(tenantToken, "lead-co"))
      .send({ category: "OTHER", subject: "Mine team", description: "A" });
    const b = await request(app)
      .post("/api/platform-support/tickets")
      .set(tenantHeaders(tenantToken, "lead-co"))
      .send({ category: "OTHER", subject: "Other team", description: "B" });

    await PlatformSupportTicket.findByIdAndUpdate(a.body.data.id, {
      assignedCentralSupportTeamId: team._id,
      assignedCentralSupportTeamName: team.name
    });
    await PlatformSupportTicket.findByIdAndUpdate(b.body.data.id, {
      assignedCentralSupportTeamId: otherTeam._id,
      assignedCentralSupportTeamName: otherTeam.name
    });

    const leadToken = await loginCentral(lead.email, "Lead@12345");
    const queue = await request(app)
      .get("/api/central-support/tickets?teamQueue=true")
      .set("Authorization", `Bearer ${leadToken}`);
    expect(queue.status).toBe(200);
    const ids = queue.body.data.items.map((t) => t.id);
    expect(ids).toContain(a.body.data.id);
    expect(ids).not.toContain(b.body.data.id);
  });
});
