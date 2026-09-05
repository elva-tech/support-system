const request = require("supertest");
const app = require("../../src/app");
const Tenant = require("../../src/modules/tenants/tenant.model");
const User = require("../../src/modules/users/user.model");
const Team = require("../../src/modules/teams/team.model");
const Application = require("../../src/modules/applications/application.model");
const Module = require("../../src/modules/modules/module.model");
const MerchantProfile = require("../../src/modules/merchants/merchant-profile.model");
const StaffInvitation = require("../../src/modules/staff-invitations/staff-invitation.model");
const Ticket = require("../../src/modules/tickets/ticket.model");
const InboundMailQueue = require("../../src/modules/inbound-mail-queue/inbound-mail-queue.model");
const ClassificationQueue = require("../../src/modules/classification/classification-queue.model");
const NotificationEvent = require("../../src/modules/notifications/notification-event.model");
const NotificationDelivery = require("../../src/modules/notifications/notification-delivery.model");
const AuditLog = require("../../src/modules/audit/audit-log.model");
const { ROLES } = require("../../src/shared/constants/roles");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { USER_STATUSES } = require("../../src/shared/constants/user-lifecycle");
const { INVITATION_STATUSES } = require("../../src/shared/constants/provisioning");
const { INBOUND_MAIL_QUEUE_STATUS } = require("../../src/shared/constants/inbound-mail-queue");
const { CLASSIFICATION_QUEUE_STATUS } = require("../../src/shared/constants/classification");
const { DELIVERY_STATUS, NOTIFICATION_PROVIDERS } = require("../../src/shared/constants/notification-types");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../src/shared/constants/audit-actions");
const { generateInvitationToken } = require("../../src/modules/tenant-provisioning/invitation-token.util");
const { loginAgent } = require("../helpers/seed");

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const tenantHeaders = (token, slug) => ({
  ...authHeader(token),
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

  const agent = await User.create({
    tenantId: tenant._id,
    email: `agent@${slug}.test`,
    password: "Agent@12345",
    firstName: "Agent",
    lastName: "One",
    role: ROLES.AGENT,
    teamId: team._id,
    applicationIds: [appDoc._id],
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
    applicationIds: [appDoc._id],
    status: USER_STATUSES.ACTIVE,
    isActive: true
  });

  return { tenant, app: appDoc, module: moduleDoc, team, admin, agent, lead };
};

describe("Phase 10 staff lifecycle and isolation", () => {
  test("ADMIN can invite staff; TEAM_LEAD and AGENT cannot; token hashed; invited cannot login", async () => {
    const a = await createWorkspace({ slug: "alpha-co", name: "Alpha Co" });
    const adminToken = await loginAgent(app, a.admin.email, "Admin@12345", {
      tenantSlug: a.tenant.slug
    });
    const leadToken = await loginAgent(app, a.lead.email, "Lead@12345", {
      tenantSlug: a.tenant.slug
    });
    const agentToken = await loginAgent(app, a.agent.email, "Agent@12345", {
      tenantSlug: a.tenant.slug
    });

    await request(app)
      .post("/api/users/invite")
      .set(tenantHeaders(leadToken, a.tenant.slug))
      .send({
        email: "newlead@alpha-co.test",
        firstName: "New",
        lastName: "Lead",
        role: ROLES.TEAM_LEAD,
        teamId: a.team._id
      })
      .expect(403);

    await request(app)
      .post("/api/users/invite")
      .set(tenantHeaders(agentToken, a.tenant.slug))
      .send({
        email: "newagent@alpha-co.test",
        firstName: "New",
        lastName: "Agent",
        role: ROLES.AGENT,
        teamId: a.team._id
      })
      .expect(403);

    await request(app)
      .post("/api/users/invite")
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .send({
        email: "staff@alpha-co.test",
        firstName: "Staff",
        lastName: "Member",
        role: ROLES.AGENT,
        teamId: a.team._id,
        password: "ShouldNotBeAccepted"
      })
      .expect(400);

    const ok = await request(app)
      .post("/api/users/invite")
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .send({
        email: "staff@alpha-co.test",
        firstName: "Staff",
        lastName: "Member",
        role: ROLES.AGENT,
        teamId: a.team._id
      })
      .expect(201);

    expect(ok.body.data.status).toBe(USER_STATUSES.INVITED);
    expect(ok.body.data.isActive).toBe(false);
    expect(JSON.stringify(ok.body)).not.toMatch(/tokenHash|rawToken/);

    const invitation = await StaffInvitation.findOne({ email: "staff@alpha-co.test" }).select(
      "+tokenHash"
    );
    expect(invitation).toBeTruthy();
    expect(invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(invitation.status).toBe(INVITATION_STATUSES.PENDING);

    await request(app)
      .post("/api/auth/login")
      .set({ "X-Tenant-Slug": a.tenant.slug })
      .send({ email: "staff@alpha-co.test", password: "anything" })
      .expect(401);
  });

  test("setup activates user; expired and used tokens rejected; resend revokes previous", async () => {
    const a = await createWorkspace({ slug: "beta-co", name: "Beta Co" });
    const adminToken = await loginAgent(app, a.admin.email, "Admin@12345", {
      tenantSlug: a.tenant.slug
    });

    await request(app)
      .post("/api/users/invite")
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .send({
        email: "invitee@beta-co.test",
        firstName: "Invitee",
        lastName: "User",
        role: ROLES.AGENT,
        teamId: a.team._id
      })
      .expect(201);

    const user = await User.findOne({ email: "invitee@beta-co.test", tenantId: a.tenant._id });
    const { rawToken, tokenHash } = generateInvitationToken();

    await StaffInvitation.updateMany(
      { userId: user._id, status: INVITATION_STATUSES.PENDING },
      { $set: { status: INVITATION_STATUSES.REVOKED, revokedAt: new Date() } }
    );
    await StaffInvitation.create({
      tenantId: a.tenant._id,
      userId: user._id,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
      tokenHash,
      status: INVITATION_STATUSES.PENDING,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByUserId: a.admin._id
    });

    const valid = await request(app).get(`/api/onboarding/invitation/${rawToken}`).expect(200);
    expect(valid.body.data.valid).toBe(true);
    expect(valid.body.data.invitationType).toBe("STAFF");
    expect(valid.body.data.tenantName).toBe("Beta Co");

    await request(app)
      .post("/api/onboarding/complete-setup")
      .send({ token: rawToken, password: "NewPass@123", confirmPassword: "NewPass@123" })
      .expect(200);

    const activated = await User.findById(user._id);
    expect(activated.status).toBe(USER_STATUSES.ACTIVE);
    expect(activated.isActive).toBe(true);

    await request(app)
      .post("/api/onboarding/complete-setup")
      .send({ token: rawToken, password: "NewPass@456", confirmPassword: "NewPass@456" })
      .expect(400);

    await request(app)
      .post("/api/auth/login")
      .set({ "X-Tenant-Slug": a.tenant.slug })
      .send({ email: "invitee@beta-co.test", password: "NewPass@123" })
      .expect(200);

    await request(app)
      .post("/api/users/invite")
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .send({
        email: "expire@beta-co.test",
        firstName: "Exp",
        lastName: "User",
        role: ROLES.AGENT,
        teamId: a.team._id
      })
      .expect(201);

    const expireUser = await User.findOne({ email: "expire@beta-co.test" });
    const expired = generateInvitationToken();
    await StaffInvitation.updateMany(
      { userId: expireUser._id, status: INVITATION_STATUSES.PENDING },
      { $set: { status: INVITATION_STATUSES.REVOKED } }
    );
    await StaffInvitation.create({
      tenantId: a.tenant._id,
      userId: expireUser._id,
      email: expireUser.email,
      role: expireUser.role,
      teamId: expireUser.teamId,
      tokenHash: expired.tokenHash,
      status: INVITATION_STATUSES.PENDING,
      expiresAt: new Date(Date.now() - 1000),
      createdByUserId: a.admin._id
    });

    const expiredCheck = await request(app)
      .get(`/api/onboarding/invitation/${expired.rawToken}`)
      .expect(200);
    expect(expiredCheck.body.data.valid).toBe(false);

    await request(app)
      .post("/api/users/invite")
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .send({
        email: "resend@beta-co.test",
        firstName: "Re",
        lastName: "Send",
        role: ROLES.AGENT,
        teamId: a.team._id
      })
      .expect(201);

    const resendUser = await User.findOne({ email: "resend@beta-co.test" });
    const first = await StaffInvitation.findOne({
      userId: resendUser._id,
      status: INVITATION_STATUSES.PENDING
    }).select("+tokenHash");
    const firstHash = first.tokenHash;

    await request(app)
      .post(`/api/users/${resendUser._id}/resend-invitation`)
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .expect(200);

    const old = await StaffInvitation.findById(first._id);
    expect(old.status).toBe(INVITATION_STATUSES.REVOKED);
    const next = await StaffInvitation.findOne({
      userId: resendUser._id,
      status: INVITATION_STATUSES.PENDING
    }).select("+tokenHash");
    expect(next.tokenHash).not.toBe(firstHash);
  });

  test("lifecycle: SUSPENDED and DEACTIVATED cannot login; reactivation works", async () => {
    const a = await createWorkspace({ slug: "gamma-co", name: "Gamma Co" });
    const adminToken = await loginAgent(app, a.admin.email, "Admin@12345", {
      tenantSlug: a.tenant.slug
    });

    await request(app)
      .post(`/api/users/${a.agent._id}/suspend`)
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .set({ "X-Tenant-Slug": a.tenant.slug })
      .send({ email: a.agent.email, password: "Agent@12345" })
      .expect(401);

    await request(app)
      .post(`/api/users/${a.agent._id}/reactivate`)
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .set({ "X-Tenant-Slug": a.tenant.slug })
      .send({ email: a.agent.email, password: "Agent@12345" })
      .expect(200);

    await request(app)
      .post(`/api/users/${a.agent._id}/deactivate`)
      .set(tenantHeaders(adminToken, a.tenant.slug))
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .set({ "X-Tenant-Slug": a.tenant.slug })
      .send({ email: a.agent.email, password: "Agent@12345" })
      .expect(401);
  });

  test("cross-tenant isolation: dashboard, queues, notifications, audit", async () => {
    const a = await createWorkspace({ slug: "tenant-a", name: "Tenant A" });
    const b = await createWorkspace({ slug: "tenant-b", name: "Tenant B" });
    const tokenA = await loginAgent(app, a.admin.email, "Admin@12345", {
      tenantSlug: a.tenant.slug
    });
    const tokenB = await loginAgent(app, b.admin.email, "Admin@12345", {
      tenantSlug: b.tenant.slug
    });

    const merchantA = await MerchantProfile.create({
      tenantId: a.tenant._id,
      applicationId: a.app._id,
      applicationCode: a.app.code,
      email: "m@a.test",
      merchantName: "Merchant A",
      externalUserId: "ext-a",
      isActive: true
    });
    const merchantB = await MerchantProfile.create({
      tenantId: b.tenant._id,
      applicationId: b.app._id,
      applicationCode: b.app.code,
      email: "m@b.test",
      merchantName: "Merchant B",
      externalUserId: "ext-b",
      isActive: true
    });

    await Ticket.create({
      tenantId: a.tenant._id,
      ticketNumber: "TA-1001",
      subject: "A ticket",
      description: "desc",
      status: "OPEN",
      applicationId: a.app._id,
      applicationCode: a.app.code,
      moduleId: a.module._id,
      teamId: a.team._id,
      assignedTo: a.agent._id,
      merchantId: merchantA._id
    });
    await Ticket.create({
      tenantId: b.tenant._id,
      ticketNumber: "TB-2001",
      subject: "B ticket",
      description: "desc",
      status: "OPEN",
      applicationId: b.app._id,
      applicationCode: b.app.code,
      moduleId: b.module._id,
      teamId: b.team._id,
      assignedTo: b.agent._id,
      merchantId: merchantB._id
    });

    const metricsA = await request(app)
      .get("/api/dashboard/agent")
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(200);
    const metricsB = await request(app)
      .get("/api/dashboard/agent")
      .set(tenantHeaders(tokenB, b.tenant.slug))
      .expect(200);

    expect(metricsA.body.data.ticketsCreatedToday).toBe(1);
    expect(metricsB.body.data.ticketsCreatedToday).toBe(1);

    const queueA = await InboundMailQueue.create({
      tenantId: a.tenant._id,
      senderEmail: "x@a.test",
      subject: "A mail",
      body: "body",
      status: INBOUND_MAIL_QUEUE_STATUS.PENDING
    });
    const queueB = await InboundMailQueue.create({
      tenantId: b.tenant._id,
      senderEmail: "x@b.test",
      subject: "B mail",
      body: "body",
      status: INBOUND_MAIL_QUEUE_STATUS.PENDING
    });
    const nullQueue = await InboundMailQueue.create({
      tenantId: null,
      senderEmail: "legacy@null.test",
      subject: "Legacy",
      body: "body",
      status: INBOUND_MAIL_QUEUE_STATUS.PENDING
    });

    const listA = await request(app)
      .get("/api/inbound-mail-queue")
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(200);
    expect(listA.body.data.some((i) => i._id === String(queueA._id))).toBe(true);
    expect(listA.body.data.some((i) => i._id === String(queueB._id))).toBe(false);
    expect(listA.body.data.some((i) => i._id === String(nullQueue._id))).toBe(false);

    await request(app)
      .get(`/api/inbound-mail-queue/${queueB._id}`)
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(404);

    const classA = await ClassificationQueue.create({
      tenantId: a.tenant._id,
      senderEmail: "c@a.test",
      subject: "class A",
      body: "",
      status: CLASSIFICATION_QUEUE_STATUS.PENDING,
      requiresManualClassification: true
    });
    const classB = await ClassificationQueue.create({
      tenantId: b.tenant._id,
      senderEmail: "c@b.test",
      subject: "class B",
      body: "",
      status: CLASSIFICATION_QUEUE_STATUS.PENDING,
      requiresManualClassification: true
    });

    const classListA = await request(app)
      .get("/api/classification/queue")
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(200);
    expect(classListA.body.data.some((i) => i._id === String(classA._id))).toBe(true);
    expect(classListA.body.data.some((i) => i._id === String(classB._id))).toBe(false);

    await request(app)
      .get(`/api/classification/queue/${classB._id}`)
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(404);

    await NotificationEvent.create({
      tenantId: a.tenant._id,
      eventType: AUDIT_ACTIONS.TICKET_CREATED,
      entityId: a.admin._id,
      processed: false,
      metadata: {}
    });
    await NotificationEvent.create({
      tenantId: b.tenant._id,
      eventType: AUDIT_ACTIONS.TICKET_CREATED,
      entityId: b.admin._id,
      processed: false,
      metadata: {}
    });
    await NotificationDelivery.create({
      tenantId: a.tenant._id,
      provider: NOTIFICATION_PROVIDERS.SMTP,
      status: DELIVERY_STATUS.FAILED,
      attemptedAt: new Date()
    });
    await NotificationDelivery.create({
      tenantId: b.tenant._id,
      provider: NOTIFICATION_PROVIDERS.SMTP,
      status: DELIVERY_STATUS.FAILED,
      attemptedAt: new Date()
    });

    const pendingA = await request(app)
      .get("/api/notification-center/pending")
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(200);
    expect(pendingA.body.data.every((e) => String(e.tenantId) === String(a.tenant._id))).toBe(true);

    const deliveriesA = await request(app)
      .get("/api/notification-center/deliveries")
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(200);
    expect(deliveriesA.body.data.every((e) => String(e.tenantId) === String(a.tenant._id))).toBe(
      true
    );

    await AuditLog.create({
      tenantId: a.tenant._id,
      entityType: ENTITY_TYPES.USER,
      entityId: a.admin._id,
      action: AUDIT_ACTIONS.AGENT_LOGIN,
      actorType: ACTOR_TYPES.AGENT,
      actorId: a.admin._id,
      actorName: "Admin",
      metadata: {}
    });
    await AuditLog.create({
      tenantId: b.tenant._id,
      entityType: ENTITY_TYPES.USER,
      entityId: b.admin._id,
      action: AUDIT_ACTIONS.AGENT_LOGIN,
      actorType: ACTOR_TYPES.AGENT,
      actorId: b.admin._id,
      actorName: "Admin",
      metadata: {}
    });

    const auditA = await request(app)
      .get("/api/audit")
      .set(tenantHeaders(tokenA, a.tenant.slug))
      .expect(200);
    expect(auditA.body.data.every((e) => String(e.tenantId) === String(a.tenant._id))).toBe(true);
    expect(auditA.body.data.some((e) => String(e.tenantId) === String(b.tenant._id))).toBe(false);
  });
});
