const request = require("supertest");
const app = require("../../src/app");
const { seedTestData, loginAgent } = require("../helpers/seed");
const Ticket = require("../../src/modules/tickets/ticket.model");
const TicketConversation = require("../../src/modules/conversations/ticket-conversation.model");
const env = require("../../src/config/env");

describe("Omnichannel & Email Integration", () => {
  let data;
  let adminToken;

  beforeEach(async () => {
    data = await seedTestData();
    adminToken = await loginAgent(app, "admin@test.com", "Admin@12345");
  });

  it("processes API inbound through omnichannel engine and creates ticket", async () => {
    const response = await request(app)
      .post("/api/omnichannel/inbound")
      .set("X-Internal-Api-Key", env.internalApiKey)
      .send({
        senderEmail: "merchant@test.com",
        subject: "Order delivery issue",
        body: "My order shipment is delayed"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.action).toBe("CREATED");
    expect(response.body.data.ticketNumber).toMatch(/^APN-/);

    const conversation = await TicketConversation.findOne({
      ticketId: response.body.data.ticketId,
      type: "SYSTEM"
    });
    expect(conversation?.message).toMatch(/auto-assigned/i);

    const ticket = await Ticket.findById(response.body.data.ticketId);
    expect(ticket.source).toBe("API");
    expect(ticket.assignedTo).toBeTruthy();
  });

  it("appends inbound message to existing ticket by reference", async () => {
    const response = await request(app)
      .post("/api/omnichannel/inbound")
      .set("X-Internal-Api-Key", env.internalApiKey)
      .send({
        senderEmail: "merchant@test.com",
        subject: `Update on ${data.ticketA.ticketNumber}`,
        body: "Any progress?"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.action).toBe("REPLY");

    const messages = await TicketConversation.find({ ticketId: data.ticketA._id });
    expect(messages.some((item) => item.source === "API")).toBe(true);
  });

  it("returns omnichannel dashboard widgets", async () => {
    const response = await request(app)
      .get("/api/dashboard/omnichannel")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      portalMessages: expect.any(Number),
      emailMessages: expect.any(Number),
      failedDeliveries: expect.any(Number),
      pendingNotifications: expect.any(Number),
      averageFirstResponseTime: expect.any(Number)
    });
    expect(response.body.data.reservedChannels).toEqual(["WHATSAPP", "SMS"]);
  });

  it("exposes notification center summary", async () => {
    const response = await request(app)
      .get("/api/notification-center/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.portalMessages).toBeGreaterThanOrEqual(0);
  });
});
