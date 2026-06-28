const request = require("supertest");

process.env.EMAIL_INBOUND_ENABLED = "true";
process.env.EMAIL_INBOUND_PROVIDER = "webhook";
process.env.EMAIL_INBOUND_WEBHOOK_SECRET = "test-webhook-secret";
process.env.EMAIL_SUPPORT_ADDRESS = "support@elvatech.in";

const app = require("../../src/app");
const InboundMailQueue = require("../../src/modules/inbound-mail-queue/inbound-mail-queue.model");

const buildRawMime = ({ from, to, subject, body, messageId }) =>
  [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    messageId ? `Message-ID: ${messageId}` : null,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body
  ]
    .filter(Boolean)
    .join("\r\n");

describe("Inbound email webhook", () => {
  it("rejects requests without the webhook secret", async () => {
    const rawMime = buildRawMime({
      from: "a@b.com",
      to: "support@elvatech.in",
      subject: "Test",
      body: "Hi",
      messageId: "<auth-test@mail>"
    });

    const response = await request(app)
      .post("/api/webhooks/inbound-email")
      .send({ rawMimeBase64: Buffer.from(rawMime).toString("base64") });

    expect(response.status).toBe(401);
  });

  it("accepts valid webhook payloads and queues unknown senders", async () => {
    const rawMime = buildRawMime({
      from: "webhook-stranger@unknown.com",
      to: "support@elvatech.in",
      subject: "Webhook queue test",
      body: "Hello support",
      messageId: "<webhook-integration@mail>"
    });

    const response = await request(app)
      .post("/api/webhooks/inbound-email")
      .set("X-Inbound-Webhook-Secret", "test-webhook-secret")
      .send({
        from: "webhook-stranger@unknown.com",
        to: "support@elvatech.in",
        rawMimeBase64: Buffer.from(rawMime).toString("base64")
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.action).toBe("QUEUED");

    const queueItem = await InboundMailQueue.findById(response.body.data.queueItemId);
    expect(queueItem).toBeTruthy();
    expect(queueItem.senderEmail).toBe("webhook-stranger@unknown.com");
  });
});
