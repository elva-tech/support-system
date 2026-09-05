const mongoose = require("mongoose");
const {
  ALL_INVITATION_STATUSES,
  INVITATION_STATUSES
} = require("../../shared/constants/provisioning");

const tenantAdminInvitationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      select: false
    },
    status: {
      type: String,
      enum: ALL_INVITATION_STATUSES,
      default: INVITATION_STATUSES.PENDING,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    createdByPlatformAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformAdmin",
      default: null
    },
    provisioningId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TenantProvisioning",
      default: null,
      index: true
    }
  },
  {
    timestamps: true,
    collection: "tenantadmininvitations"
  }
);

tenantAdminInvitationSchema.index({ tokenHash: 1 }, { unique: true });

module.exports = mongoose.model("TenantAdminInvitation", tenantAdminInvitationSchema);
