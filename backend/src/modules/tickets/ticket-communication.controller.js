const asyncHandler = require("../../shared/utils/asyncHandler");
const conversationService = require("../conversations/conversation.service");
const { mapAttachmentForClient } = require("../attachments/attachment.service");
const { SENDER_TYPES } = require("../../shared/constants/conversation-types");

const reply = asyncHandler(async (req, res) => {
  const agent = req.user;
  const conversation = await conversationService.addReply(req.params.id, {
    senderType: SENDER_TYPES.AGENT,
    senderId: agent._id,
    senderName: `${agent.firstName} ${agent.lastName}`,
    message: req.body.message
  });

  res.status(201).json({ message: "Reply sent", data: conversation });
});

const internalNote = asyncHandler(async (req, res) => {
  const agent = req.user;
  const conversation = await conversationService.addInternalNote(req.params.id, {
    senderId: agent._id,
    senderName: `${agent.firstName} ${agent.lastName}`,
    message: req.body.message
  });

  res.status(201).json({ message: "Internal note added", data: conversation });
});

const updateStatus = asyncHandler(async (req, res) => {
  const ticket = await conversationService.updateStatus(req.params.id, req.body.status, req.user);
  res.json({ message: "Status updated", data: ticket });
});

const transfer = asyncHandler(async (req, res) => {
  const ticket = await conversationService.transferTicket(req.params.id, req.body.teamId, req.user);
  res.json({ message: "Ticket transferred", data: ticket });
});

const timeline = asyncHandler(async (req, res) => {
  const result = await conversationService.getTimeline(req.params.id, { includeInternalNotes: true });
  res.json({ data: result.timeline });
});

const upload = asyncHandler(async (req, res) => {
  const agent = req.user;
  const attachment = await conversationService.uploadAttachment(
    req.params.id,
    req.file,
    `agent:${agent.firstName} ${agent.lastName}`,
    req.body.conversationId || null
  );

  res.status(201).json({ message: "Attachment uploaded", data: mapAttachmentForClient(attachment) });
});

module.exports = { reply, internalNote, updateStatus, transfer, timeline, upload };
