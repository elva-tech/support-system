const mongoose = require("mongoose");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");

const auditLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: Object.values(ENTITY_TYPES),
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true
    },
    actorType: {
      type: String,
      enum: Object.values(ACTOR_TYPES),
      required: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    actorName: {
      type: String,
      required: true,
      trim: true
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

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
