const mongoose = require("mongoose");
const { EMAIL_DIRECTION } = require("../../shared/constants/communication-channels");

const emailThreadSchema = new mongoose.Schema(
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
    messageId: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    inReplyTo: {
      type: String,
      default: null,
      trim: true
    },
    references: {
      type: [String],
      default: []
    },
    direction: {
      type: String,
      enum: Object.values(EMAIL_DIRECTION),
      required: true
    },
    subject: {
      type: String,
      default: ""
    },
    fromEmail: {
      type: String,
      default: ""
    },
    toEmail: {
      type: String,
      default: ""
    }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "email_threads" }
);

emailThreadSchema.index({ ticketId: 1, createdAt: -1 });

module.exports = mongoose.model("EmailThread", emailThreadSchema);
