const emailInboundWebhookService = require("./email-inbound-webhook.service");
const ApiError = require("../../shared/utils/ApiError");
const logger = require("../../shared/utils/logger");

const receiveInboundEmail = async (req, res, next) => {
  try {
    if (!emailInboundWebhookService.isConfigured()) {
      throw new ApiError(503, "Inbound email webhook is disabled");
    }

    const fromHint = req.body?.from || null;
    logger.info("Inbound email webhook received", {
      from: fromHint,
      to: req.body?.to || null,
      mimeBytes: req.body?.rawMimeBase64 ? Buffer.byteLength(req.body.rawMimeBase64, "base64") : 0
    });

    const result = await emailInboundWebhookService.processWebhookPayload(req.body);

    logger.info("Inbound email webhook processed", {
      from: fromHint,
      action: result.action || result.status,
      ticketNumber: result.ticketNumber || null,
      reason: result.reason || null
    });

    res.status(200).json({
      success: true,
      data: {
        action: result.action || result.status,
        ticketId: result.ticketId || null,
        ticketNumber: result.ticketNumber || null,
        queueItemId: result.queueItemId || null,
        messageId: result.messageId || null
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  receiveInboundEmail
};
