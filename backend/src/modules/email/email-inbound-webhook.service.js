const { simpleParser } = require("mailparser");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const ApiError = require("../../shared/utils/ApiError");
const { processParsedEmail } = require("./email-inbound-processor.service");

const isConfigured = () =>
  Boolean(
    env.email.inboundEnabled &&
      env.email.inboundProvider === "webhook" &&
      env.email.inboundWebhookSecret
  );

const processWebhookPayload = async (payload) => {
  if (!payload?.rawMimeBase64) {
    throw new ApiError(400, "rawMimeBase64 is required");
  }

  let raw;
  try {
    raw = Buffer.from(payload.rawMimeBase64, "base64");
  } catch {
    throw new ApiError(400, "rawMimeBase64 must be valid base64");
  }

  if (!raw.length) {
    throw new ApiError(400, "rawMimeBase64 is empty");
  }

  const parsed = await simpleParser(raw);
  const sourceRef = parsed.messageId || payload.messageId || `webhook-${Date.now()}`;

  const result = await processParsedEmail(parsed, sourceRef, {
    requireSupportRecipient: true
  });

  if (result.action === "SKIPPED" && result.reason === "NOT_SUPPORT_ALIAS") {
    logger.info("Inbound webhook skipped — not addressed to support@", {
      from: payload.from || parsed.from?.value?.[0]?.address,
      to: payload.to
    });
    return { ...result, status: "SKIPPED" };
  }

  if (result.action === "REPLY" || result.action === "CREATED") {
    logger.info("Inbound support email synced via webhook", {
      action: result.action,
      ticketNumber: result.ticketNumber || null,
      subject: parsed.subject
    });
  }

  return result;
};

module.exports = {
  isConfigured,
  processWebhookPayload
};
