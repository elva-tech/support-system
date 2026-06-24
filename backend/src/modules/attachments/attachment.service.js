const fs = require("fs");
const path = require("path");
const ApiError = require("../../shared/utils/ApiError");
const env = require("../../config/env");
const Attachment = require("./attachment.model");
const Ticket = require("../tickets/ticket.model");
const TicketAccessPolicy = require("../tickets/ticket-access.policy");
const { createGoogleDriveService } = require("../../shared/services/google-drive/google-drive.service");

const driveService = createGoogleDriveService();

const getDownloadPath = (attachmentId) => `/api/attachments/${attachmentId}/download`;

const mapAttachmentForClient = (attachment) => {
  const doc = attachment.toObject ? attachment.toObject() : attachment;
  return {
    ...doc,
    driveUrl: getDownloadPath(doc._id)
  };
};

const assertMerchantAccess = async (merchantId, attachment) => {
  const ticket = await Ticket.findById(attachment.ticketId);
  if (!ticket || ticket.merchantId.toString() !== merchantId.toString()) {
    throw new ApiError(403, "You do not have access to this attachment");
  }
  return ticket;
};

const assertAgentAccess = async (user, attachment) => {
  await TicketAccessPolicy.assertAccess(user, attachment.ticketId);
};

const getAttachmentForDownload = async ({ attachmentId, user, merchant }) => {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  let ticket;
  if (merchant) {
    ticket = await assertMerchantAccess(merchant._id, attachment);
  } else if (user) {
    ticket = await TicketAccessPolicy.assertAccess(user, attachment.ticketId);
  } else {
    throw new ApiError(401, "Authentication required");
  }

  if (env.googleDrive.useMock || !driveService.getFileStream) {
    const filePath = path.join(env.uploadsDir, ticket.ticketNumber, attachment.fileName);
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, "File not found");
    }

    return {
      filePath,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType
    };
  }

  const streamResult = await driveService.getFileStream(attachment.driveFileId);
  return {
    stream: streamResult.stream,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType
  };
};

module.exports = {
  getDownloadPath,
  mapAttachmentForClient,
  getAttachmentForDownload
};
