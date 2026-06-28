const ApiError = require("../../shared/utils/ApiError");
const TicketConversation = require("../conversations/ticket-conversation.model");
const Attachment = require("../attachments/attachment.model");
const Ticket = require("../tickets/ticket.model");
const Team = require("../teams/team.model");
const ticketService = require("../tickets/ticket.service");
const { logAudit } = require("../audit/audit.service");
const notificationService = require("../notifications/notification.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const { WORKER_NOTIFICATION_TYPES } = require("../../shared/constants/notification-types");
const { createGoogleDriveService } = require("../../shared/services/google-drive/google-drive.service");
const { CONVERSATION_TYPES, SENDER_TYPES } = require("../../shared/constants/conversation-types");
const { ALL_TICKET_STATUSES, TICKET_STATUSES, ACTIVE_TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");
const { CONVERSATION_SOURCES } = require("../../shared/constants/communication-channels");
const emailOutboundService = require("../email/email-outbound.service");
const { mapAttachmentForClient } = require("../attachments/attachment.service");

const driveService = createGoogleDriveService();

const buildInitialTimelineItem = (ticket) => {
  const merchant = ticket.merchantId;
  const merchantName = typeof merchant === "object" ? merchant.merchantName : "Merchant";
  const merchantId = typeof merchant === "object" ? merchant._id : merchant;

  return {
    _id: `initial-${ticket._id}`,
    ticketId: ticket._id,
    type: CONVERSATION_TYPES.MESSAGE,
    senderType: SENDER_TYPES.MERCHANT,
    senderId: merchantId,
    senderName: merchantName,
    message: ticket.description,
    source: ticket.source || CONVERSATION_SOURCES.PORTAL,
    createdAt: ticket.createdAt,
    isInitial: true,
    attachments: []
  };
};

const mapConversation = (conversation, attachments = []) => ({
  _id: conversation._id,
  ticketId: conversation.ticketId,
  type: conversation.type,
  senderType: conversation.senderType,
  senderId: conversation.senderId,
  senderName: conversation.senderName,
  message: conversation.message,
  source: conversation.source || CONVERSATION_SOURCES.PORTAL,
  channelMetadata: conversation.channelMetadata || {},
  createdAt: conversation.createdAt,
  attachments
});

const mapAttachmentItem = (attachment) => ({
  _id: attachment._id,
  ticketId: attachment.ticketId,
  type: "ATTACHMENT",
  senderType: attachment.uploadedBy.startsWith("merchant:") ? SENDER_TYPES.MERCHANT : SENDER_TYPES.AGENT,
  senderId: null,
  senderName: attachment.uploadedBy.replace(/^(merchant|agent):/, ""),
  message: `Uploaded file: ${attachment.fileName}`,
  createdAt: attachment.uploadedAt,
  attachment: mapAttachmentForClient(attachment)
});

const getTimeline = async (ticketId, { includeInternalNotes = false } = {}) => {
  const ticket = await ticketService.getById(ticketId);

  const conversationQuery = { ticketId };
  if (!includeInternalNotes) {
    conversationQuery.type = { $ne: CONVERSATION_TYPES.INTERNAL_NOTE };
  }

  const [conversations, attachments] = await Promise.all([
    TicketConversation.find(conversationQuery).sort({ createdAt: 1 }),
    Attachment.find({ ticketId }).sort({ uploadedAt: 1 })
  ]);

  const attachmentsByConversation = attachments.reduce((acc, att) => {
    const key = att.conversationId?.toString() || "standalone";
    if (!acc[key]) acc[key] = [];
    acc[key].push(mapAttachmentForClient(att));
    return acc;
  }, {});

  const items = [buildInitialTimelineItem(ticket)];

  for (const conversation of conversations) {
    const key = conversation._id.toString();
    items.push(mapConversation(conversation, attachmentsByConversation[key] || []));
  }

  for (const attachment of attachments) {
    if (!attachment.conversationId) {
      items.push(mapAttachmentItem(attachment));
    }
  }

  items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return { ticket, timeline: items };
};

const addReply = async (
  ticketId,
  {
    senderType,
    senderId,
    senderName,
    message,
    source = CONVERSATION_SOURCES.PORTAL,
    channelMetadata = {},
    externalMessageId = null,
    skipOutboundEmail = false
  }
) => {
  const ticket = await ticketService.getById(ticketId);

  const conversationPayload = {
    ticketId,
    type: CONVERSATION_TYPES.MESSAGE,
    senderType,
    senderId,
    senderName,
    message,
    source,
    channelMetadata
  };

  if (externalMessageId) {
    conversationPayload.externalMessageId = externalMessageId;
  }

  const conversation = await TicketConversation.create(conversationPayload);

  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticketId,
    action: AUDIT_ACTIONS.REPLY_ADDED,
    actorType: senderType === SENDER_TYPES.MERCHANT ? ACTOR_TYPES.MERCHANT : ACTOR_TYPES.AGENT,
    actorId: senderId,
    actorName: senderName,
    metadata: { conversationId: conversation._id.toString(), source }
  });

  if (senderType === SENDER_TYPES.AGENT) {
    await notificationService.createEvent(WORKER_NOTIFICATION_TYPES.AGENT_REPLY, ticketId, {
      conversationId: conversation._id.toString(),
      message,
      senderName,
      source
    });
  }

  if (
    !skipOutboundEmail &&
    source !== CONVERSATION_SOURCES.EMAIL &&
    senderType !== SENDER_TYPES.MERCHANT
  ) {
    const merchant =
      typeof ticket.merchantId === "object"
        ? ticket.merchantId
        : await require("../merchants/merchant-profile.model").findById(ticket.merchantId);

    await emailOutboundService.sendTimelineEmail({
      ticket,
      merchant,
      message,
      senderName,
      senderType,
      conversationId: conversation._id
    });
  }

  return conversation;
};

const addInternalNote = async (ticketId, { senderId, senderName, message }) => {
  await ticketService.getById(ticketId);

  const note = await TicketConversation.create({
    ticketId,
    type: CONVERSATION_TYPES.INTERNAL_NOTE,
    senderType: SENDER_TYPES.AGENT,
    senderId,
    senderName,
    message
  });

  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticketId,
    action: AUDIT_ACTIONS.INTERNAL_NOTE_ADDED,
    actorType: ACTOR_TYPES.AGENT,
    actorId: senderId,
    actorName: senderName,
    metadata: { conversationId: note._id.toString() }
  });

  return note;
};

const addSystemEvent = async (ticketId, message) => {
  return TicketConversation.create({
    ticketId,
    type: CONVERSATION_TYPES.SYSTEM,
    senderType: SENDER_TYPES.SYSTEM,
    senderId: null,
    senderName: "System",
    message
  });
};

const updateStatus = async (ticketId, status, agent) => {
  if (!ALL_TICKET_STATUSES.includes(status)) {
    throw new ApiError(400, "Invalid ticket status");
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  const previousStatus = ticket.status;
  const previousAssignee = ticket.assignedTo;
  if (previousStatus === status) {
    return ticketService.getById(ticketId);
  }

  ticket.status = status;
  await ticket.save();

  const agentName = `${agent.firstName} ${agent.lastName}`;
  await addSystemEvent(
    ticketId,
    `Status changed from ${previousStatus} to ${status} by ${agentName}`
  );

  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.STATUS_CHANGED,
    actorType: ACTOR_TYPES.AGENT,
    actorId: agent._id,
    actorName: agentName,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      previousStatus,
      newStatus: status
    }
  });

  if (status === TICKET_STATUSES.RESOLVED) {
    await notificationService.createEvent(WORKER_NOTIFICATION_TYPES.TICKET_RESOLVED, ticket._id, {
      ticketNumber: ticket.ticketNumber,
      previousStatus,
      newStatus: status
    });
  }

  const becameInactive =
    ACTIVE_TICKET_STATUSES.includes(previousStatus) && !ACTIVE_TICKET_STATUSES.includes(status);

  if (becameInactive && previousAssignee) {
    const { onAgentPotentiallyFreed } = require("../tickets/ticket-auto-assign.service");
    await onAgentPotentiallyFreed(previousAssignee, ticket.teamId);
  }

  return ticketService.getById(ticketId);
};

const transferTicket = async (ticketId, teamId, agent) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new ApiError(404, "Ticket not found");
  }

  const newTeam = await Team.findById(teamId);
  if (!newTeam || !newTeam.isActive) {
    throw new ApiError(400, "Invalid team");
  }

  const previousTeam = await Team.findById(ticket.teamId);
  const previousTeamName = previousTeam?.name || "Unknown";
  const agentName = `${agent.firstName} ${agent.lastName}`;

  ticket.teamId = newTeam._id;
  await ticket.save();

  await addSystemEvent(
    ticketId,
    `Ticket transferred from ${previousTeamName} to ${newTeam.name} by ${agentName}`
  );

  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_TRANSFERRED,
    actorType: ACTOR_TYPES.AGENT,
    actorId: agent._id,
    actorName: agentName,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      previousTeamId: previousTeam?._id?.toString() || null,
      previousTeamName,
      newTeamId: newTeam._id.toString(),
      newTeamName: newTeam.name
    }
  });

  return ticketService.getById(ticketId);
};

const uploadAttachment = async (ticketId, file, uploadedByLabel, conversationId = null) => {
  const ticket = await ticketService.getById(ticketId);

  if (conversationId) {
    const conversation = await TicketConversation.findOne({ _id: conversationId, ticketId });
    if (!conversation) {
      throw new ApiError(400, "Invalid conversation for attachment");
    }
  }

  const driveResult = await driveService.uploadFile(ticket.ticketNumber, file);

  const attachment = await Attachment.create({
    ticketId,
    conversationId: conversationId || null,
    fileName: driveResult.fileName || file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    driveFileId: driveResult.driveFileId,
    driveUrl: driveResult.driveUrl,
    uploadedBy: uploadedByLabel,
    uploadedAt: new Date()
  });

  const isMerchant = uploadedByLabel.startsWith("merchant:");
  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.ATTACHMENT_UPLOADED,
    actorType: isMerchant ? ACTOR_TYPES.MERCHANT : ACTOR_TYPES.AGENT,
    actorId: null,
    actorName: uploadedByLabel.replace(/^(merchant|agent):/, ""),
    metadata: {
      ticketNumber: ticket.ticketNumber,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType
    }
  });

  return attachment;
};

module.exports = {
  getTimeline,
  addReply,
  addInternalNote,
  addSystemEvent,
  updateStatus,
  transferTicket,
  uploadAttachment
};
