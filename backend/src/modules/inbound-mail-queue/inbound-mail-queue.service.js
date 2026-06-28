const fs = require("fs");
const path = require("path");
const ApiError = require("../../shared/utils/ApiError");
const env = require("../../config/env");
const InboundMailQueue = require("./inbound-mail-queue.model");
const Application = require("../applications/application.model");
const Module = require("../modules/module.model");
const Team = require("../teams/team.model");
const MerchantProfile = require("../merchants/merchant-profile.model");
const Ticket = require("../tickets/ticket.model");
const Attachment = require("../attachments/attachment.model");
const TicketConversation = require("../conversations/ticket-conversation.model");
const { INBOUND_MAIL_QUEUE_STATUS } = require("../../shared/constants/inbound-mail-queue");
const { CONVERSATION_SOURCES } = require("../../shared/constants/communication-channels");
const { SENDER_TYPES } = require("../../shared/constants/conversation-types");
const { parsePagination, buildPaginationMeta } = require("../../shared/utils/pagination.util");
const { createGoogleDriveService } = require("../../shared/services/google-drive/google-drive.service");
const { sendAssignedEmail, sendRejectedEmail } = require("./inbound-mail-response-email.service");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");
const logger = require("../../shared/utils/logger");

const driveService = createGoogleDriveService();
const QUEUE_FOLDER_PREFIX = "INBOUND-MAIL";

const populateOptions = [
  { path: "assignedTeamId", select: "name" },
  { path: "assignedApplicationId", select: "name code" },
  { path: "assignedModuleId", select: "name code" },
  { path: "ticketId", select: "ticketNumber status subject" },
  { path: "reviewedBy", select: "firstName lastName email" }
];

const persistAttachments = async (queueKey, files = []) => {
  const stored = [];

  for (const file of files) {
    const upload = await driveService.uploadFile(`${QUEUE_FOLDER_PREFIX}-${queueKey}`, file);
    stored.push({
      fileName: upload.fileName || file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      driveFileId: upload.driveFileId,
      driveUrl: upload.driveUrl
    });
  }

  return stored;
};

const enqueueFromEmail = async ({
  senderEmail,
  senderName,
  subject,
  body,
  attachments = [],
  externalMessageId = null,
  channelMetadata = {}
}) => {
  if (externalMessageId) {
    const existing = await InboundMailQueue.findOne({ externalMessageId });
    if (existing) {
      return existing;
    }
  }

  const item = await InboundMailQueue.create({
    senderEmail: senderEmail.toLowerCase(),
    senderName: senderName || "",
    subject,
    body: body || "",
    attachments: [],
    externalMessageId,
    channelMetadata,
    status: INBOUND_MAIL_QUEUE_STATUS.PENDING
  });

  if (attachments.length) {
    item.attachments = await persistAttachments(item._id.toString(), attachments);
    await item.save();
  }

  logger.info("Unknown sender email queued for admin review", {
    queueItemId: item._id.toString(),
    senderEmail: item.senderEmail,
    subject: item.subject,
    attachmentCount: item.attachments.length
  });

  return item;
};

const listQueue = async (filters = {}) => {
  const { page, limit, skip } = parsePagination(filters);
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  } else {
    query.status = INBOUND_MAIL_QUEUE_STATUS.PENDING;
  }

  const [data, total] = await Promise.all([
    InboundMailQueue.find(query).populate(populateOptions).sort({ createdAt: -1 }).skip(skip).limit(limit),
    InboundMailQueue.countDocuments(query)
  ]);

  return {
    data,
    pagination: buildPaginationMeta({ page, limit, total })
  };
};

const getQueueItem = async (id) => {
  const item = await InboundMailQueue.findById(id).populate(populateOptions);
  if (!item) {
    throw new ApiError(404, "Inbound mail queue item not found");
  }
  return item;
};

const ensureMerchantForSender = async ({ senderEmail, senderName, application }) => {
  const email = senderEmail.toLowerCase();
  let merchant = await MerchantProfile.findOne({ email });

  if (merchant) {
    if (merchant.applicationId.toString() !== application._id.toString()) {
      throw new ApiError(
        400,
        "This email is already registered as a merchant under a different application"
      );
    }
    return merchant;
  }

  const localPart = email.split("@")[0] || "contact";
  merchant = await MerchantProfile.create({
    applicationId: application._id,
    applicationCode: application.code,
    email,
    merchantName: senderName || localPart.replace(/[._-]+/g, " "),
    externalUserId: `email-${email}`,
    isActive: true
  });

  return merchant;
};

const copyQueueAttachmentsToTicket = async (item, ticket, conversationId, merchant) => {
  const label = `merchant:${merchant.merchantName}`;
  const created = [];

  for (const att of item.attachments) {
    const sourcePath = path.join(env.uploadsDir, `${QUEUE_FOLDER_PREFIX}-${item._id.toString()}`, att.fileName);

    let buffer = null;
    if (fs.existsSync(sourcePath)) {
      buffer = fs.readFileSync(sourcePath);
    }

    if (buffer) {
      const upload = await driveService.uploadFile(ticket.ticketNumber, {
        originalname: att.fileName,
        mimetype: att.mimeType,
        size: att.fileSize,
        buffer
      });

      const attachment = await Attachment.create({
        ticketId: ticket._id,
        conversationId,
        fileName: upload.fileName || att.fileName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        driveFileId: upload.driveFileId,
        driveUrl: upload.driveUrl,
        uploadedBy: label,
        uploadedAt: new Date()
      });
      created.push(attachment);
      continue;
    }

    const attachment = await Attachment.create({
      ticketId: ticket._id,
      conversationId,
      fileName: att.fileName,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      driveFileId: att.driveFileId,
      driveUrl: att.driveUrl,
      uploadedBy: label,
      uploadedAt: new Date()
    });
    created.push(attachment);
  }

  return created;
};

const assignToTeam = async (id, adminUser, payload) => {
  const item = await InboundMailQueue.findById(id);
  if (!item) {
    throw new ApiError(404, "Inbound mail queue item not found");
  }

  if (item.status !== INBOUND_MAIL_QUEUE_STATUS.PENDING) {
    throw new ApiError(400, "Only pending inbound mail items can be assigned");
  }

  const [application, moduleDoc, team] = await Promise.all([
    Application.findById(payload.applicationId),
    Module.findOne({
      _id: payload.moduleId,
      applicationId: payload.applicationId,
      isActive: true
    }),
    Team.findOne({ _id: payload.teamId, isActive: true })
  ]);

  if (!application) {
    throw new ApiError(404, "Application not found");
  }
  if (!moduleDoc) {
    throw new ApiError(400, "Module not found for the selected application");
  }
  if (!team) {
    throw new ApiError(404, "Team not found");
  }

  if (team.applicationId && team.applicationId.toString() !== application._id.toString()) {
    throw new ApiError(400, "Selected team does not belong to the chosen application");
  }

  const merchant = await ensureMerchantForSender({
    senderEmail: item.senderEmail,
    senderName: item.senderName,
    application
  });

  const ticketService = require("../tickets/ticket.service");

  const ticket = await ticketService.createForMerchant(merchant, {
    moduleId: moduleDoc._id,
    subject: item.subject,
    description: item.body || item.subject,
    source: CONVERSATION_SOURCES.EMAIL,
    channelMetadata: item.channelMetadata,
    teamId: team._id,
    skipTicketCreatedNotification: true
  });

  const conversation = await TicketConversation.findOne({ ticketId: ticket._id }).sort({
    createdAt: 1
  });

  if (conversation) {
    await TicketConversation.findByIdAndUpdate(conversation._id, {
      source: CONVERSATION_SOURCES.EMAIL,
      externalMessageId: item.externalMessageId,
      channelMetadata: item.channelMetadata
    });
  }

  await copyQueueAttachmentsToTicket(item, ticket, conversation?._id || null, merchant);

  item.status = INBOUND_MAIL_QUEUE_STATUS.ASSIGNED;
  item.assignedTeamId = team._id;
  item.assignedApplicationId = application._id;
  item.assignedModuleId = moduleDoc._id;
  item.ticketId = ticket._id;
  item.reviewedBy = adminUser._id;
  item.reviewedAt = new Date();
  item.adminNotes = payload.notes || "";
  await item.save();

  const emailResult = await sendAssignedEmail({
    to: item.senderEmail,
    senderName: item.senderName,
    ticketNumber: ticket.ticketNumber,
    teamName: team.name,
    subject: item.subject,
    adminNotes: item.adminNotes
  });

  if (!emailResult.success) {
    logger.warn("Assigned notification email failed", {
      queueItemId: item._id.toString(),
      error: emailResult.error
    });
  }

  await logAudit({
    entityType: ENTITY_TYPES.TICKET,
    entityId: ticket._id,
    action: AUDIT_ACTIONS.TICKET_CREATED,
    actorType: ACTOR_TYPES.AGENT,
    actorId: adminUser._id,
    actorName: `${adminUser.firstName} ${adminUser.lastName}`,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      inboundMailQueueId: item._id.toString(),
      assignedTeamId: team._id.toString()
    },
    skipNotificationEvent: true
  });

  return getQueueItem(item._id);
};

const rejectMail = async (id, adminUser, reason) => {
  const item = await InboundMailQueue.findById(id);
  if (!item) {
    throw new ApiError(404, "Inbound mail queue item not found");
  }

  if (item.status !== INBOUND_MAIL_QUEUE_STATUS.PENDING) {
    throw new ApiError(400, "Only pending inbound mail items can be rejected");
  }

  if (!reason?.trim()) {
    throw new ApiError(400, "A rejection reason is required");
  }

  item.status = INBOUND_MAIL_QUEUE_STATUS.REJECTED;
  item.reviewedBy = adminUser._id;
  item.reviewedAt = new Date();
  item.rejectReason = reason.trim();
  await item.save();

  const emailResult = await sendRejectedEmail({
    to: item.senderEmail,
    senderName: item.senderName,
    subject: item.subject,
    reason: item.rejectReason
  });

  if (!emailResult.success) {
    logger.warn("Rejection notification email failed", {
      queueItemId: item._id.toString(),
      error: emailResult.error
    });
  }

  return getQueueItem(item._id);
};

const getAttachmentDownload = async (queueItemId, attachmentId) => {
  const item = await InboundMailQueue.findById(queueItemId);
  if (!item) {
    throw new ApiError(404, "Inbound mail queue item not found");
  }

  const attachment = item.attachments.id(attachmentId);
  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  const folderKey = `${QUEUE_FOLDER_PREFIX}-${item._id.toString()}`;
  const filePath = path.join(env.uploadsDir, folderKey, attachment.fileName);

  if (!fs.existsSync(filePath)) {
    throw new ApiError(404, "Attachment file not found on server");
  }

  return {
    filePath,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType
  };
};

module.exports = {
  enqueueFromEmail,
  listQueue,
  getQueueItem,
  assignToTeam,
  rejectMail,
  getAttachmentDownload
};
