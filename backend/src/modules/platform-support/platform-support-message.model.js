const mongoose = require("mongoose");

const platformSupportMessageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformSupportTicket",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["MESSAGE", "INTERNAL_NOTE"],
      default: "MESSAGE"
    },
    senderType: {
      type: String,
      enum: ["TENANT_USER", "PLATFORM_ADMIN", "CENTRAL_SUPPORT", "SYSTEM"],
      required: true
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    senderName: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 10000 }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "platformsupportmessages"
  }
);

platformSupportMessageSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model("PlatformSupportMessage", platformSupportMessageSchema);
