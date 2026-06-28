const request = require("supertest");
const app = require("../../src/app");
const { seedTestData, loginAgent } = require("../helpers/seed");
const { TICKET_STATUSES } = require("../../src/shared/constants/ticket-statuses");

describe("ELVA Support Integration", () => {
  let data;

  beforeEach(async () => {
    data = await seedTestData();
  });

  describe("Agent Login", () => {
    it("logs in a valid agent", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "agent-a@test.com", password: "Agent@12345" });

      expect(response.status).toBe(200);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe("agent-a@test.com");
    });
  });

  describe("Merchant OTP", () => {
    it("requests and verifies OTP with explicit delivery status", async () => {
      const unknown = await request(app)
        .post("/api/merchant/request-otp")
        .send({ email: "unknown@test.com" });

      expect(unknown.status).toBe(200);
      expect(unknown.body.sent).toBe(false);
      expect(unknown.body.message).toMatch(/No merchant account/i);

      const otpRequest = await request(app)
        .post("/api/merchant/request-otp")
        .send({ email: "merchant@test.com" });

      expect(otpRequest.status).toBe(200);
      expect(otpRequest.body.sent).toBe(true);
      expect(otpRequest.body.otp).toBeDefined();

      const verify = await request(app)
        .post("/api/merchant/verify-otp")
        .send({ email: "merchant@test.com", otpCode: otpRequest.body.otp });

      expect(verify.status).toBe(200);
      expect(verify.body.data.sessionToken).toBeDefined();
    });

    it("locks OTP after repeated failed attempts", async () => {
      const otpRequest = await request(app)
        .post("/api/merchant/request-otp")
        .send({ email: "merchant@test.com" });

      for (let i = 0; i < 5; i += 1) {
        await request(app)
          .post("/api/merchant/verify-otp")
          .send({ email: "merchant@test.com", otpCode: "000000" });
      }

      const lockedAttempt = await request(app)
        .post("/api/merchant/verify-otp")
        .send({ email: "merchant@test.com", otpCode: otpRequest.body.otp });

      expect(lockedAttempt.status).toBe(400);
      expect(lockedAttempt.body.message).toMatch(/Invalid email or OTP code/i);
    });
  });

  describe("Ticket operations", () => {
    it("creates a merchant ticket", async () => {
      const otpRequest = await request(app)
        .post("/api/merchant/request-otp")
        .send({ email: "merchant@test.com" });

      const verify = await request(app)
        .post("/api/merchant/verify-otp")
        .send({ email: "merchant@test.com", otpCode: otpRequest.body.otp });

      const session = verify.body.data.sessionToken;

      const create = await request(app)
        .post("/api/merchant/tickets")
        .set("X-Merchant-Session", session)
        .send({
          moduleId: data.moduleDoc._id.toString(),
          subject: "New merchant ticket",
          description: "Need help with order"
        });

      expect(create.status).toBe(201);
      expect(create.body.data.ticketNumber).toBeDefined();
    });

    it("assigns a ticket as team lead", async () => {
      const token = await loginAgent(app, "lead-a@test.com", "Lead@12345");

      const response = await request(app)
        .patch(`/api/tickets/${data.ticketA._id}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: data.agentA._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.data.assignedTo).toBeDefined();
    });

    it("transfers a ticket within authorized access", async () => {
      const token = await loginAgent(app, "lead-a@test.com", "Lead@12345");

      const response = await request(app)
        .patch(`/api/tickets/${data.ticketA._id}/transfer`)
        .set("Authorization", `Bearer ${token}`)
        .send({ teamId: data.teamB._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.data.teamId._id || response.body.data.teamId).toBe(
        data.teamB._id.toString()
      );
    });

    it("updates ticket status", async () => {
      const token = await loginAgent(app, "agent-a@test.com", "Agent@12345");

      const response = await request(app)
        .patch(`/api/tickets/${data.ticketA._id}/status`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: TICKET_STATUSES.IN_PROGRESS });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(TICKET_STATUSES.IN_PROGRESS);
    });
  });

  describe("Authorization", () => {
    it("prevents agent from Team B accessing Team A ticket", async () => {
      const token = await loginAgent(app, "agent-b@test.com", "Agent@12345");

      const response = await request(app)
        .get(`/api/tickets/${data.ticketA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/do not have access/i);
    });

    it("allows agent from Team A to access Team A ticket", async () => {
      const token = await loginAgent(app, "agent-a@test.com", "Agent@12345");

      const response = await request(app)
        .get(`/api/tickets/${data.ticketA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data._id).toBe(data.ticketA._id.toString());
    });

    it("blocks unauthorized ticket reply", async () => {
      const token = await loginAgent(app, "agent-b@test.com", "Agent@12345");

      const response = await request(app)
        .post(`/api/tickets/${data.ticketA._id}/reply`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "Should not send" });

      expect(response.status).toBe(403);
    });
  });

  describe("Attachment download", () => {
    it("allows authorized agent to download attachment", async () => {
      const token = await loginAgent(app, "agent-a@test.com", "Agent@12345");

      const response = await request(app)
        .get(`/api/attachments/${data.attachment._id}/download`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.text).toContain("test attachment content");
    });

    it("blocks agent from another team downloading attachment", async () => {
      const token = await loginAgent(app, "agent-b@test.com", "Agent@12345");

      const response = await request(app)
        .get(`/api/attachments/${data.attachment._id}/download`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it("rejects unauthenticated attachment download", async () => {
      const response = await request(app).get(
        `/api/attachments/${data.attachment._id}/download`
      );

      expect(response.status).toBe(401);
    });
  });
});
