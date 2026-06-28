const emailInboundWebhookService = require("./email-inbound-webhook.service");
const ApiError = require("../../shared/utils/ApiError");

const receiveInboundEmail = async (req, res, next) => {
  try {
    if (!emailInboundWebhookService.isConfigured()) {
      throw new ApiError(503, "Inbound email webhook is disabled");
    }

    const result = await emailInboundWebhookService.processWebhookPayload(req.body);

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
