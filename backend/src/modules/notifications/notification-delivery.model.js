const mongoose = require("mongoose");
const { NOTIFICATION_PROVIDERS, DELIVERY_STATUS } = require("../../shared/constants/notification-types");

const notificationDeliverySchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NotificationEvent",
      default: null
    },
    provider: {
      type: String,
      enum: Object.values(NOTIFICATION_PROVIDERS),
      required: true
    },
    status: {
      type: String,
      enum: Object.values(DELIVERY_STATUS),
      required: true
    },
    errorMessage: {
      type: String,
      default: null
    },
    attemptedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

notificationDeliverySchema.index({ eventId: 1, attemptedAt: -1 });
notificationDeliverySchema.index({ provider: 1, status: 1, attemptedAt: -1 });

module.exports = mongoose.model("NotificationDelivery", notificationDeliverySchema);
