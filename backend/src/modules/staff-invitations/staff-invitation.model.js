const mongoose = require("mongoose");
const { ALL_ROLES } = require("../../shared/constants/roles");
const {
  ALL_INVITATION_STATUSES,
  INVITATION_STATUSES
} = require("../../shared/constants/provisioning");

/**
 * Staff invitations (Phase 10) — distinct from TenantAdminInvitation (platform provisioning).
 * Raw token is never stored; only tokenHash.
 */
const staffInvitationSchema = new mongoose.Schema(
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
    role: {
      type: String,
      enum: ALL_ROLES,
      required: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
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
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    revokedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: "staffinvitations"
  }
);

staffInvitationSchema.index({ tokenHash: 1 }, { unique: true });
staffInvitationSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
staffInvitationSchema.index({ tenantId: 1, userId: 1, status: 1 });

module.exports = mongoose.model("StaffInvitation", staffInvitationSchema);
