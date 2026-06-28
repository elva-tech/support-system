process.env.EMAIL_INBOUND_ENABLED = "true";
process.env.EMAIL_INBOUND_PROVIDER = "webhook";
process.env.EMAIL_INBOUND_WEBHOOK_SECRET = "test-webhook-secret";
process.env.EMAIL_SUPPORT_ADDRESS = "support@elvatech.in";

const emailInboundWebhookService = require("../../src/modules/email/email-inbound-webhook.service");

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

describe("email-inbound-webhook.service", () => {
  it("rejects payloads without rawMimeBase64", async () => {
    await expect(emailInboundWebhookService.processWebhookPayload({})).rejects.toMatchObject({
      statusCode: 400,
      message: "rawMimeBase64 is required"
    });
  });

  it("queues unknown senders addressed to support@", async () => {
    const rawMime = buildRawMime({
      from: "stranger@unknown.com",
      to: "support@elvatech.in",
      subject: "Need help",
      body: "Please assist",
      messageId: "<webhook-unit-test@mail>"
    });

    const result = await emailInboundWebhookService.processWebhookPayload({
      rawMimeBase64: Buffer.from(rawMime).toString("base64")
    });

    expect(result.action).toBe("QUEUED");
    expect(result.queueType).toBe("INBOUND_MAIL");
  });
});
