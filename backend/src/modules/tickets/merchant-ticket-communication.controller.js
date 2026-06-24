const asyncHandler = require("../../shared/utils/asyncHandler");
const conversationService = require("../conversations/conversation.service");
const ticketService = require("./ticket.service");
const { mapAttachmentForClient } = require("../attachments/attachment.service");
const { SENDER_TYPES } = require("../../shared/constants/conversation-types");

const merchantReply = asyncHandler(async (req, res) => {
  await ticketService.getForMerchant(req.merchant._id, req.params.id);

  const conversation = await conversationService.addReply(req.params.id, {
    senderType: SENDER_TYPES.MERCHANT,
    senderId: req.merchant._id,
    senderName: req.merchant.merchantName,
    message: req.body.message
  });

  res.status(201).json({ message: "Reply sent", data: conversation });
});

const merchantTimeline = asyncHandler(async (req, res) => {
  await ticketService.getForMerchant(req.merchant._id, req.params.id);
  const result = await conversationService.getTimeline(req.params.id, { includeInternalNotes: false });
  res.json({ data: result.timeline });
});

const merchantUpload = asyncHandler(async (req, res) => {
  await ticketService.getForMerchant(req.merchant._id, req.params.id);

  const attachment = await conversationService.uploadAttachment(
    req.params.id,
    req.file,
    `merchant:${req.merchant.merchantName}`,
    req.body.conversationId || null
  );

  res.status(201).json({ message: "Attachment uploaded", data: mapAttachmentForClient(attachment) });
});

module.exports = { merchantReply, merchantTimeline, merchantUpload };
