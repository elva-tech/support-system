const mongoose = require("mongoose");
const { INBOUND_MAIL_QUEUE_STATUS } = require("../../shared/constants/inbound-mail-queue");

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    fileSize: { type: Number, default: 0 },
    driveFileId: { type: String, default: "" },
    driveUrl: { type: String, default: "" }
  },
  { _id: true }
);

const inboundMailQueueSchema = new mongoose.Schema(
  {
    senderEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    senderName: {
      type: String,
      default: "",
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      default: ""
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    },
    externalMessageId: {
      type: String,
      default: null,
      trim: true
    },
    channelMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: Object.values(INBOUND_MAIL_QUEUE_STATUS),
      default: INBOUND_MAIL_QUEUE_STATUS.PENDING
    },
    assignedTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
    },
    assignedApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null
    },
    assignedModuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      default: null
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    adminNotes: {
      type: String,
      default: ""
    },
    rejectReason: {
      type: String,
      default: ""
    }
  },
  { timestamps: true, collection: "inbound_mail_queue" }
);

inboundMailQueueSchema.index({ status: 1, createdAt: -1 });
inboundMailQueueSchema.index({ senderEmail: 1, createdAt: -1 });
inboundMailQueueSchema.index({ externalMessageId: 1 }, { sparse: true });

module.exports = mongoose.model("InboundMailQueue", inboundMailQueueSchema);
