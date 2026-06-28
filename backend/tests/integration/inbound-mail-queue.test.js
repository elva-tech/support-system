const request = require("supertest");
const app = require("../../src/app");
const { seedTestData, loginAgent } = require("../helpers/seed");
const InboundMailQueue = require("../../src/modules/inbound-mail-queue/inbound-mail-queue.model");
const Ticket = require("../../src/modules/tickets/ticket.model");
const env = require("../../src/config/env");

describe("Inbound Mail Queue", () => {
  let data;
  let adminToken;

  beforeEach(async () => {
    data = await seedTestData();
    adminToken = await loginAgent(app, "admin@test.com", "Admin@12345");
  });

  it("queues unknown EMAIL senders and allows admin assign/reject with notifications", async () => {
    const inbound = await request(app)
      .post("/api/omnichannel/inbound")
      .set("X-Internal-Api-Key", env.internalApiKey)
      .send({
        source: "EMAIL",
        senderEmail: "stranger@unknown.com",
        senderName: "Stranger",
        subject: "Need help with payouts",
        body: "Please assist",
        channelMetadata: { messageId: "<stranger-test@mail>" }
      });

    expect(inbound.status).toBe(200);
    expect(inbound.body.data.action).toBe("QUEUED");
    expect(inbound.body.data.queueType).toBe("INBOUND_MAIL");

    const queueItem = await InboundMailQueue.findById(inbound.body.data.queueItemId);
    expect(queueItem.status).toBe("PENDING");

    const list = await request(app)
      .get("/api/inbound-mail-queue")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(list.status).toBe(200);
    expect(list.body.data.some((item) => item._id === queueItem._id.toString())).toBe(true);

    const assign = await request(app)
      .post(`/api/inbound-mail-queue/${queueItem._id}/assign`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        teamId: data.teamA._id.toString(),
        applicationId: data.application._id.toString(),
        moduleId: data.moduleDoc._id.toString(),
        notes: "We are looking into this"
      });

    expect(assign.status).toBe(200);
    expect(assign.body.data.status).toBe("ASSIGNED");
    expect(assign.body.data.ticketId).toBeTruthy();

    const ticket = await Ticket.findById(assign.body.data.ticketId._id || assign.body.data.ticketId);
    expect(ticket.teamId.toString()).toBe(data.teamA._id.toString());
  });

  it("rejects unknown inbound mail with reason", async () => {
    const item = await InboundMailQueue.create({
      senderEmail: "spam@example.com",
      senderName: "Spam",
      subject: "Buy now",
      body: "Spam body",
      status: "PENDING"
    });

    const reject = await request(app)
      .post(`/api/inbound-mail-queue/${item._id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "This is not a support request" });

    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe("REJECTED");
    expect(reject.body.data.rejectReason).toBe("This is not a support request");
  });
});
