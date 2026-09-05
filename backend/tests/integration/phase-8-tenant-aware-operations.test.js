const request = require("supertest");
const app = require("../../src/app");
const { seedTestData, loginAgent } = require("../helpers/seed");
const Tenant = require("../../src/modules/tenants/tenant.model");
const Application = require("../../src/modules/applications/application.model");
const Team = require("../../src/modules/teams/team.model");
const Module = require("../../src/modules/modules/module.model");
const MerchantProfile = require("../../src/modules/merchants/merchant-profile.model");
const Ticket = require("../../src/modules/tickets/ticket.model");
const EmailThread = require("../../src/modules/email/email-thread.model");
const InboundMailQueue = require("../../src/modules/inbound-mail-queue/inbound-mail-queue.model");
const ClassificationQueue = require("../../src/modules/classification/classification-queue.model");
const NotificationEvent = require("../../src/modules/notifications/notification-event.model");
const NotificationDelivery = require("../../src/modules/notifications/notification-delivery.model");
const TicketConversation = require("../../src/modules/conversations/ticket-conversation.model");
const emailThreadService = require("../../src/modules/email/email-thread.service");
const emailOutboundService = require("../../src/modules/email/email-outbound.service");
const classificationEngine = require("../../src/modules/classification/engines/classification.engine");
const omnichannelEngine = require("../../src/modules/omnichannel/conversation-engine.service");
const inboundMailQueueService = require("../../src/modules/inbound-mail-queue/inbound-mail-queue.service");
const notificationService = require("../../src/modules/notifications/notification.service");
const { EMAIL_DIRECTION } = require("../../src/shared/constants/communication-channels");
const { TENANT_STATUSES } = require("../../src/shared/constants/tenant");
const { INBOUND_MAIL_ROUTING_STATUS } = require("../../src/shared/constants/inbound-mail-queue");
const { WORKER_NOTIFICATION_TYPES } = require("../../src/shared/constants/notification-types");
const env = require("../../src/config/env");

const createSecondTenantFixture = async (email = "shared@customer.com") => {
  const tenant = await Tenant.create({
    name: "ABC Company",
    slug: "abc",
    status: TENANT_STATUSES.ACTIVE
  });

  const application = await Application.create({
    tenantId: tenant._id,
    name: "ABC App",
    code: "ABC",
    isActive: true
  });

  const team = await Team.create({
    tenantId: tenant._id,
    name: "ABC Team",
    applicationId: application._id,
    isActive: true
  });

  const moduleDoc = await Module.create({
    name: "General",
    code: "GEN",
    applicationId: application._id,
    defaultTeamId: team._id,
    isActive: true
  });

  const merchant = await MerchantProfile.create({
    tenantId: tenant._id,
    applicationId: application._id,
    applicationCode: "ABC",
    externalUserId: "abc-merchant-1",
    merchantName: "Shared Customer ABC",
    email,
    isActive: true
  });

  const ticket = await Ticket.create({
    tenantId: tenant._id,
    ticketNumber: "ABC-2026-100001",
    applicationId: application._id,
    applicationCode: "ABC",
    moduleId: moduleDoc._id,
    merchantId: merchant._id,
    teamId: team._id,
    subject: "ABC ticket",
    description: "ABC issue",
    status: "OPEN"
  });

  return { tenant, application, team, moduleDoc, merchant, ticket };
};

describe("Phase 8 tenant-aware operations", () => {
  let data;

  beforeEach(async () => {
    data = await seedTestData();
  });

  test("outbound email thread receives correct tenantId", async () => {
    const result = await emailOutboundService.sendTimelineEmail({
      ticket: data.ticketA,
      merchant: data.merchant,
      message: "Hello from support",
      senderName: "Agent A",
      senderType: "AGENT",
      conversationId: null,
      isNewTicket: false
    });

    expect(result.success).toBe(true);

    const thread = await EmailThread.findOne({
      ticketId: data.ticketA._id,
      direction: EMAIL_DIRECTION.OUTBOUND
    }).sort({ createdAt: -1 });

    expect(thread).toBeTruthy();
    expect(thread.tenantId.toString()).toBe(data.tenantId.toString());
  });

  test("notification event and delivery preserve tenantId", async () => {
    await notificationService.createEvent(
      WORKER_NOTIFICATION_TYPES.TICKET_CREATED,
      data.ticketA._id,
      { ticketNumber: data.ticketA.ticketNumber },
      { tenantId: data.tenantId }
    );

    const event = await NotificationEvent.findOne({
      entityId: data.ticketA._id,
      eventType: WORKER_NOTIFICATION_TYPES.TICKET_CREATED
    }).sort({ createdAt: -1 });

    expect(event).toBeTruthy();
    expect(event.tenantId.toString()).toBe(data.tenantId.toString());

    const deliveryService = require("../../src/modules/notifications/notification-delivery.service");
    await deliveryService.recordSuccess("SMTP", event._id, { tenantId: data.tenantId });

    const delivery = await NotificationDelivery.findOne({ eventId: event._id });
    expect(delivery.tenantId.toString()).toBe(data.tenantId.toString());
  });

  test("existing email reply resolves to correct tenant via thread headers", async () => {
    const messageId = "<elva-outbound-1@elvatech.in>";
    await emailThreadService.recordThreadMessage({
      tenantId: data.tenantId,
      ticketId: data.ticketA._id,
      messageId,
      direction: EMAIL_DIRECTION.OUTBOUND,
      subject: `[${data.ticketA.ticketNumber}] hello`,
      fromEmail: env.email.supportAddress,
      toEmail: data.merchant.email
    });

    const classification = await classificationEngine.classify({
      senderEmail: data.merchant.email,
      subject: `Re: [${data.ticketA.ticketNumber}] hello`,
      body: "Following up",
      channelMetadata: { inReplyTo: messageId, references: [messageId] }
    });

    expect(classification.isExistingTicket).toBe(true);
    expect(classification.existingTicket.id).toBe(data.ticketA._id.toString());
    expect(classification.tenantId.toString()).toBe(data.tenantId.toString());
  });

  test("same sender email across two tenants does not auto-route new mail", async () => {
    const sharedEmail = "shared@customer.com";
    await MerchantProfile.findByIdAndUpdate(data.merchant._id, { email: sharedEmail });
    const other = await createSecondTenantFixture(sharedEmail);

    const result = await omnichannelEngine.processInbound({
      source: "EMAIL",
      senderEmail: sharedEmail,
      subject: "Brand new request",
      body: "Which tenant am I?"
    });

    expect(result.action).toBe("QUEUED");
    expect(result.routingStatus).toBe(INBOUND_MAIL_ROUTING_STATUS.AMBIGUOUS);

    const queueItem = await InboundMailQueue.findById(result.queueItemId);
    expect(queueItem.routingStatus).toBe(INBOUND_MAIL_ROUTING_STATUS.AMBIGUOUS);
    expect(queueItem.tenantId).toBeFalsy();

    const tickets = await Ticket.find({ subject: "Brand new request" });
    expect(tickets).toHaveLength(0);
    expect(other.ticket.tenantId.toString()).not.toBe(data.tenantId.toString());
  });

  test("reply to ABC ticket resolves ABC even when sender email exists in ELVA", async () => {
    const sharedEmail = "shared-reply@customer.com";
    await MerchantProfile.findByIdAndUpdate(data.merchant._id, { email: sharedEmail });
    const other = await createSecondTenantFixture(sharedEmail);

    const messageId = "<abc-outbound-1@elvatech.in>";
    await emailThreadService.recordThreadMessage({
      tenantId: other.tenant._id,
      ticketId: other.ticket._id,
      messageId,
      direction: EMAIL_DIRECTION.OUTBOUND,
      subject: `[${other.ticket.ticketNumber}] hello`,
      fromEmail: env.email.supportAddress,
      toEmail: sharedEmail
    });

    const result = await omnichannelEngine.processInbound({
      source: "EMAIL",
      senderEmail: sharedEmail,
      subject: `Re: [${other.ticket.ticketNumber}] hello`,
      body: "Reply to ABC",
      externalMessageId: "<abc-inbound-reply-1@mail>",
      channelMetadata: {
        messageId: "<abc-inbound-reply-1@mail>",
        inReplyTo: messageId,
        references: [messageId]
      }
    });

    expect(result.action).toBe("REPLY");
    expect(result.ticketId).toBe(other.ticket._id.toString());
    expect(result.tenantId).toBe(other.tenant._id.toString());
  });

  test("cross-tenant thread cannot attach to another tenant ticket", async () => {
    const other = await createSecondTenantFixture("unique-abc@customer.com");
    const messageId = "<elva-only@elvatech.in>";
    await emailThreadService.recordThreadMessage({
      tenantId: data.tenantId,
      ticketId: data.ticketA._id,
      messageId,
      direction: EMAIL_DIRECTION.OUTBOUND,
      subject: "ELVA thread",
      fromEmail: env.email.supportAddress,
      toEmail: data.merchant.email
    });

    const context = await emailThreadService.findTicketContextByThreadHeaders(messageId, [messageId]);
    expect(context.ticketId.toString()).toBe(data.ticketA._id.toString());
    expect(context.tenantId.toString()).toBe(data.tenantId.toString());
    expect(context.ticketId.toString()).not.toBe(other.ticket._id.toString());
  });

  test("known inbound message preserves tenantId through queue enqueue", async () => {
    const item = await inboundMailQueueService.enqueueFromEmail({
      senderEmail: "known@test.com",
      subject: "Needs review",
      body: "Please classify",
      tenantId: data.tenantId,
      routingStatus: INBOUND_MAIL_ROUTING_STATUS.RESOLVED,
      routingReason: "TEST"
    });

    expect(item.tenantId.toString()).toBe(data.tenantId.toString());
    expect(item.routingStatus).toBe(INBOUND_MAIL_ROUTING_STATUS.RESOLVED);

    const reloaded = await InboundMailQueue.findById(item._id);
    expect(reloaded.tenantId.toString()).toBe(data.tenantId.toString());
  });

  test("classification queue preserves tenantId", async () => {
    const classificationService = require("../../src/modules/classification/classification.service");
    const queued = await classificationService.classifyConversation({
      senderEmail: "stranger@phase8.test",
      subject: "Hello",
      body: "No context",
      tenantId: data.tenantId,
      enqueue: true
    });

    expect(queued.queueItemId).toBeTruthy();
    const item = await ClassificationQueue.findById(queued.queueItemId);
    expect(item.tenantId.toString()).toBe(data.tenantId.toString());
  });

  test("retry/reprocess preserves inbound queue tenantId", async () => {
    const item = await InboundMailQueue.create({
      tenantId: data.tenantId,
      senderEmail: "retry@test.com",
      subject: "Retry me",
      body: "body",
      status: "PENDING",
      routingStatus: INBOUND_MAIL_ROUTING_STATUS.RESOLVED,
      routingReason: "KNOWN"
    });

    item.adminNotes = "reprocess attempt";
    await item.save();

    const reloaded = await InboundMailQueue.findById(item._id);
    expect(reloaded.tenantId.toString()).toBe(data.tenantId.toString());
    expect(reloaded.routingStatus).toBe(INBOUND_MAIL_ROUTING_STATUS.RESOLVED);
  });

  test("worker-style notification creation does not depend on HTTP request context", async () => {
    // No req — only ticket + explicit tenantId
    await notificationService.createEvent(
      WORKER_NOTIFICATION_TYPES.TICKET_ASSIGNED,
      data.ticketA._id,
      { assignedToName: "Agent A" },
      { tenantId: data.ticketA.tenantId }
    );

    const event = await NotificationEvent.findOne({
      entityId: data.ticketA._id,
      eventType: WORKER_NOTIFICATION_TYPES.TICKET_ASSIGNED
    }).sort({ createdAt: -1 });

    expect(event.tenantId.toString()).toBe(data.tenantId.toString());
  });

  test("cross-tenant attachment download is denied safely", async () => {
    const other = await createSecondTenantFixture("attach-abc@customer.com");
    const adminToken = await loginAgent(app, "admin@test.com", "Admin@12345", {
      tenantSlug: "elva"
    });

    const response = await request(app)
      .get(`/api/attachments/${data.attachment._id}/download`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Tenant-Slug", other.tenant.slug);

    // Membership mismatch or ticket tenant mismatch → safe denial
    expect([403, 404]).toContain(response.status);
    expect(response.body?.message || "").not.toMatch(/exists in/i);
  });

  test("ELVA attachment download still works with tenant context", async () => {
    const token = await loginAgent(app, "agent-a@test.com", "Agent@12345");

    const response = await request(app)
      .get(`/api/attachments/${data.attachment._id}/download`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Tenant-Slug", "elva");

    expect(response.status).toBe(200);
    expect(response.text).toContain("test attachment content");
  });

  test("ambiguous new inbound email without thread is unresolved, not auto-assigned", async () => {
    const result = await omnichannelEngine.processInbound({
      source: "EMAIL",
      senderEmail: "totally-unknown@nowhere.test",
      subject: "Help please",
      body: "I need support"
    });

    expect(result.action).toBe("QUEUED");
    const queueItem = await InboundMailQueue.findById(result.queueItemId);
    expect(queueItem.routingStatus).toBe(INBOUND_MAIL_ROUTING_STATUS.UNRESOLVED);
    expect(queueItem.tenantId).toBeFalsy();
    expect(await TicketConversation.countDocuments({})).toBe(0);
  });

  test("suspended tenant inbound reply is preserved without active workflow", async () => {
    const suspended = await Tenant.create({
      name: "Suspended Co",
      slug: "suspended-co",
      status: TENANT_STATUSES.SUSPENDED
    });

    const application = await Application.create({
      tenantId: suspended._id,
      name: "Sus App",
      code: "SUS",
      isActive: true
    });
    const team = await Team.create({
      tenantId: suspended._id,
      name: "Sus Team",
      applicationId: application._id,
      isActive: true
    });
    const moduleDoc = await Module.create({
      name: "Gen",
      code: "GEN",
      applicationId: application._id,
      defaultTeamId: team._id,
      isActive: true
    });
    const merchant = await MerchantProfile.create({
      tenantId: suspended._id,
      applicationId: application._id,
      applicationCode: "SUS",
      externalUserId: "sus-1",
      merchantName: "Suspended Merchant",
      email: "suspended-merchant@test.com",
      isActive: true
    });
    const ticket = await Ticket.create({
      tenantId: suspended._id,
      ticketNumber: "SUS-2026-000001",
      applicationId: application._id,
      applicationCode: "SUS",
      moduleId: moduleDoc._id,
      merchantId: merchant._id,
      teamId: team._id,
      subject: "Old ticket",
      description: "desc",
      status: "OPEN"
    });

    const messageId = "<suspended-outbound@elvatech.in>";
    await emailThreadService.recordThreadMessage({
      tenantId: suspended._id,
      ticketId: ticket._id,
      messageId,
      direction: EMAIL_DIRECTION.OUTBOUND,
      subject: "old",
      fromEmail: env.email.supportAddress,
      toEmail: merchant.email
    });

    const result = await omnichannelEngine.processInbound({
      source: "EMAIL",
      senderEmail: merchant.email,
      subject: "Re: old",
      body: "Still need help",
      externalMessageId: "<suspended-inbound@mail>",
      channelMetadata: {
        messageId: "<suspended-inbound@mail>",
        inReplyTo: messageId,
        references: [messageId]
      }
    });

    expect(result.action).toBe("QUEUED");
    expect(result.routingStatus).toBe(INBOUND_MAIL_ROUTING_STATUS.FAILED);
    const queueItem = await InboundMailQueue.findById(result.queueItemId);
    expect(queueItem.tenantId.toString()).toBe(suspended._id.toString());
    expect(queueItem.routingReason).toMatch(/NOT_OPERABLE/);
    expect(await TicketConversation.countDocuments({ ticketId: ticket._id })).toBe(0);
  });
});
