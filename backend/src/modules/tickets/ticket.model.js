const mongoose = require("mongoose");
const { ALL_TICKET_STATUSES, TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");
const {
  CONVERSATION_SOURCES,
  ACTIVE_CONVERSATION_SOURCES
} = require("../../shared/constants/communication-channels");

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true
    },
    applicationCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: true
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantProfile",
      required: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ALL_TICKET_STATUSES,
      default: TICKET_STATUSES.OPEN
    },
    source: {
      type: String,
      enum: [...ACTIVE_CONVERSATION_SOURCES, ...Object.values(CONVERSATION_SOURCES)],
      default: CONVERSATION_SOURCES.PORTAL
    },
    channelMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

ticketSchema.index({ merchantId: 1, createdAt: -1 });
ticketSchema.index({ teamId: 1, status: 1 });
ticketSchema.index({ applicationCode: 1, createdAt: -1 });
ticketSchema.index({ teamId: 1, assignedTo: 1, status: 1, createdAt: 1 });
ticketSchema.index({ subject: "text" });

module.exports = mongoose.model("Ticket", ticketSchema);
