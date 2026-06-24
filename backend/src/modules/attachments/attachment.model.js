const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TicketConversation",
      default: null
    },
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    driveFileId: {
      type: String,
      required: true,
      trim: true
    },
    driveUrl: {
      type: String,
      required: true,
      trim: true
    },
    uploadedBy: {
      type: String,
      required: true,
      trim: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: false }
);

attachmentSchema.index({ ticketId: 1, uploadedAt: 1 });

module.exports = mongoose.model("Attachment", attachmentSchema);
