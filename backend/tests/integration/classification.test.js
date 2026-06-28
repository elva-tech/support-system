const request = require("supertest");
const app = require("../../src/app");
const { seedTestData, loginAgent } = require("../helpers/seed");
const Ticket = require("../../src/modules/tickets/ticket.model");
const ApplicationProfile = require("../../src/modules/classification/application-profile.model");
const ClassificationQueue = require("../../src/modules/classification/classification-queue.model");

describe("Classification Engine", () => {
  let data;
  let agentToken;
  let leadToken;

  beforeEach(async () => {
    data = await seedTestData();
    agentToken = await loginAgent(app, "agent-a@test.com", "Agent@12345");
    leadToken = await loginAgent(app, "lead-a@test.com", "Lead@12345");
  });

  const classify = (payload, token = agentToken) =>
    request(app)
      .post("/api/classification/classify")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

  it("classifies existing ticket by reference in subject", async () => {
    const ticket = await Ticket.create({
      ticketNumber: "APN-2026-000099",
      applicationId: data.application._id,
      applicationCode: "APN",
      moduleId: data.moduleDoc._id,
      merchantId: data.merchant._id,
      teamId: data.teamA._id,
      subject: "Existing issue",
      description: "Help",
      status: "OPEN"
    });

    const response = await classify({
      senderEmail: "unknown@test.com",
      subject: `Follow up on ${ticket.ticketNumber}`,
      body: "Please update"
    });

    expect(response.status).toBe(200);
    expect(response.body.data.isExistingTicket).toBe(true);
    expect(response.body.data.application.code).toBe("APN");
    expect(response.body.data.module.code).toBe("ORDERS");
    expect(response.body.data.matchedBy).toBe("TICKET_REFERENCE");
    expect(response.body.data.requiresManualClassification).toBe(false);
    expect(response.body.data.confidence).toBe(1);
  });

  it("classifies application and module from sender email and subject keywords", async () => {
    const response = await classify({
      senderEmail: "merchant@test.com",
      subject: "Order not delivered",
      body: "My shipment is delayed"
    });

    expect(response.status).toBe(200);
    expect(response.body.data.isExistingTicket).toBe(false);
    expect(response.body.data.application.code).toBe("APN");
    expect(response.body.data.module.code).toBe("ORDERS");
    expect(response.body.data.requiresManualClassification).toBe(false);
    expect(response.body.data.confidence).toBeGreaterThan(0.55);
  });

  it("enqueues low-confidence items for manual classification", async () => {
    const response = await classify({
      senderEmail: "stranger@test.com",
      subject: "Hello there",
      body: "General question"
    });

    expect(response.status).toBe(200);
    expect(response.body.data.requiresManualClassification).toBe(true);
    expect(response.body.data.matchedBy).toBe("MANUAL");
    expect(response.body.data.queueItemId).toBeTruthy();

    const queue = await ClassificationQueue.findById(response.body.data.queueItemId);
    expect(queue.status).toBe("PENDING");
  });

  it("lists and resolves needs classification queue items", async () => {
    await classify({
      senderEmail: "stranger@test.com",
      subject: "Random",
      body: "No keywords"
    });

    const list = await request(app)
      .get("/api/classification/queue")
      .set("Authorization", `Bearer ${leadToken}`);

    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);

    const itemId = list.body.data[0]._id;
    const resolve = await request(app)
      .patch(`/api/classification/queue/${itemId}/resolve`)
      .set("Authorization", `Bearer ${leadToken}`)
      .send({
        applicationId: data.application._id.toString(),
        moduleId: data.moduleDoc._id.toString(),
        notes: "Manually classified"
      });

    expect(resolve.status).toBe(200);
    expect(resolve.body.data.status).toBe("RESOLVED");
    expect(resolve.body.data.resolvedModuleId).toBeTruthy();
  });

  it("manages application profiles", async () => {
    const adminToken = await loginAgent(app, "admin@test.com", "Admin@12345");

    const existing = await ApplicationProfile.findOne({ applicationId: data.application._id });
    const response = await request(app)
      .put(`/api/classification/profiles/${existing._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        keywords: ["apnacart", "merchant", "support"],
        modules: [
          {
            moduleId: data.moduleDoc._id.toString(),
            keywords: ["order", "delivery", "shipment", "refund"]
          }
        ],
        confidenceThreshold: 0.55
      });

    expect(response.status).toBe(200);
    expect(response.body.data.keywords).toContain("support");
  });
});
