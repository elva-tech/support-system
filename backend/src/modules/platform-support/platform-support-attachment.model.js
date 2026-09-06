const mongoose = require("mongoose");

const platformSupportAttachmentSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformSupportTicket",
      required: true,
      index: true
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformSupportMessage",
      default: null
    },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileSize: { type: Number, required: true },
    storagePath: { type: String, required: true, trim: true },
    uploadedBy: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false,
    collection: "platformsupportattachments"
  }
);

platformSupportAttachmentSchema.index({ ticketId: 1, uploadedAt: 1 });

module.exports = mongoose.model("PlatformSupportAttachment", platformSupportAttachmentSchema);
