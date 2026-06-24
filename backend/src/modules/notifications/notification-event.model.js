const mongoose = require("mongoose");
const { AUDIT_ACTIONS } = require("../../shared/constants/audit-actions");
const { WORKER_NOTIFICATION_TYPES } = require("../../shared/constants/notification-types");

const NOTIFICATION_EVENT_TYPES = [
  AUDIT_ACTIONS.TICKET_CREATED,
  AUDIT_ACTIONS.TICKET_ASSIGNED,
  AUDIT_ACTIONS.TICKET_TRANSFERRED,
  AUDIT_ACTIONS.STATUS_CHANGED,
  AUDIT_ACTIONS.REPLY_ADDED,
  AUDIT_ACTIONS.INTERNAL_NOTE_ADDED,
  AUDIT_ACTIONS.ATTACHMENT_UPLOADED,
  WORKER_NOTIFICATION_TYPES.AGENT_REPLY,
  WORKER_NOTIFICATION_TYPES.TICKET_RESOLVED
];

const notificationEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: NOTIFICATION_EVENT_TYPES,
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    processed: {
      type: Boolean,
      default: false
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

notificationEventSchema.index({ processed: 1, createdAt: 1 });
notificationEventSchema.index({ entityId: 1, eventType: 1 });

module.exports = mongoose.model("NotificationEvent", notificationEventSchema);
module.exports.NOTIFICATION_EVENT_TYPES = NOTIFICATION_EVENT_TYPES;
