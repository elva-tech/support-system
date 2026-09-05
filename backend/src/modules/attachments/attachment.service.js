const fs = require("fs");
const path = require("path");
const ApiError = require("../../shared/utils/ApiError");
const env = require("../../config/env");
const Attachment = require("./attachment.model");
const Ticket = require("../tickets/ticket.model");
const TicketAccessPolicy = require("../tickets/ticket-access.policy");
const { createGoogleDriveService } = require("../../shared/services/google-drive/google-drive.service");
const {
  loadTenantById,
  buildTicketStorageFolder
} = require("../../shared/utils/tenant-ops.util");
const { idsEqual } = require("../tenants/tenant-resolver.service");

const driveService = createGoogleDriveService();

const getDownloadPath = (attachmentId) => `/api/attachments/${attachmentId}/download`;

const mapAttachmentForClient = (attachment) => {
  const doc = attachment.toObject ? attachment.toObject() : attachment;
  return {
    ...doc,
    driveUrl: getDownloadPath(doc._id)
  };
};

const resolveLocalFilePath = async (ticket, attachment) => {
  const tenant = ticket.tenantId ? await loadTenantById(ticket.tenantId) : null;
  const tenantPath = path.join(
    env.uploadsDir,
    buildTicketStorageFolder({
      tenantSlug: tenant?.slug,
      ticketNumber: ticket.ticketNumber
    }),
    attachment.fileName
  );
  if (fs.existsSync(tenantPath)) {
    return tenantPath;
  }

  // Backward compatible legacy layout: uploads/{ticketNumber}/{fileName}
  const legacyPath = path.join(env.uploadsDir, ticket.ticketNumber, attachment.fileName);
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }

  return null;
};

/**
 * Download is tenant-safe:
 * 1. Resolve attachment
 * 2. Resolve parent ticket
 * 3. Require ticket.tenantId to match request tenant (404 on mismatch — no existence leak)
 * 4. Apply existing ticket ACL
 */
const getAttachmentForDownload = async ({ attachmentId, user, merchant, tenantId = null }) => {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  const ticket = await Ticket.findById(attachment.ticketId);
  if (!ticket) {
    throw new ApiError(404, "Attachment not found");
  }

  if (tenantId) {
    if (!ticket.tenantId || !idsEqual(ticket.tenantId, tenantId)) {
      throw new ApiError(404, "Attachment not found");
    }
  }

  if (merchant) {
    if (ticket.merchantId.toString() !== merchant._id.toString()) {
      throw new ApiError(404, "Attachment not found");
    }
    if (merchant.tenantId && ticket.tenantId && !idsEqual(merchant.tenantId, ticket.tenantId)) {
      throw new ApiError(404, "Attachment not found");
    }
  } else if (user) {
    await TicketAccessPolicy.assertAccess(user, attachment.ticketId, {
      tenantId: tenantId || user.tenantId || null
    });
  } else {
    throw new ApiError(401, "Authentication required");
  }

  if (env.googleDrive.useMock || !driveService.getFileStream) {
    const filePath = await resolveLocalFilePath(ticket, attachment);
    if (!filePath) {
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
