const mongoose = require("mongoose");
const {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../../shared/constants/platform");

const platformAuditLogSchema = new mongoose.Schema(
  {
    actorPlatformAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformAdmin",
      default: null,
      index: true
    },
    actorEmail: {
      type: String,
      default: "",
      trim: true
    },
    action: {
      type: String,
      enum: Object.values(PLATFORM_AUDIT_ACTIONS),
      required: true,
      index: true
    },
    targetType: {
      type: String,
      enum: Object.values(PLATFORM_AUDIT_TARGET_TYPES),
      required: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "platformauditlogs"
  }
);

platformAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PlatformAuditLog", platformAuditLogSchema);
