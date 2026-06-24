const mongoose = require("mongoose");
const { CONVERSATION_TYPES, SENDER_TYPES } = require("../../shared/constants/conversation-types");

const ticketConversationSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(CONVERSATION_TYPES),
      required: true
    },
    senderType: {
      type: String,
      enum: Object.values(SENDER_TYPES),
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    senderName: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

ticketConversationSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model("TicketConversation", ticketConversationSchema);
