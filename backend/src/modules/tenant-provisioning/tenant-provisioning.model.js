const mongoose = require("mongoose");
const {
  ALL_PROVISIONING_STATUSES,
  PROVISIONING_STATUSES,
  defaultProvisioningSteps
} = require("../../shared/constants/provisioning");

const stepSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      default: "PENDING"
    },
    completedAt: {
      type: Date,
      default: null
    },
    /** String (legacy) or structured { message, code, technicalDetails, failedAt, retryable } */
    error: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  { _id: false }
);

const tenantProvisioningSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true,
      index: true
    },
    tenantSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    tenantName: {
      type: String,
      required: true,
      trim: true
    },
    requestedByPlatformAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformAdmin",
      required: true,
      index: true
    },
    tenantAdminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    tenantAdminName: {
      type: String,
      required: true,
      trim: true
    },
    tenantAdminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    workspaceUrl: {
      type: String,
      default: ""
    },
    invitationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TenantAdminInvitation",
      default: null
    },
    status: {
      type: String,
      enum: ALL_PROVISIONING_STATUSES,
      default: PROVISIONING_STATUSES.PENDING,
      required: true,
      index: true
    },
    steps: {
      type: {
        tenantCreated: { type: stepSchema, default: () => ({ status: "PENDING" }) },
        workspaceInitialized: { type: stepSchema, default: () => ({ status: "PENDING" }) },
        adminCreated: { type: stepSchema, default: () => ({ status: "PENDING" }) },
        invitationCreated: { type: stepSchema, default: () => ({ status: "PENDING" }) },
        welcomeEmail: { type: stepSchema, default: () => ({ status: "PENDING" }) }
      },
      default: defaultProvisioningSteps
    },
    failure: {
      code: { type: String, default: null },
      message: { type: String, default: null },
      atStep: { type: String, default: null },
      at: { type: Date, default: null }
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    collection: "tenantprovisionings"
  }
);

tenantProvisioningSchema.index({ status: 1, createdAt: -1 });
tenantProvisioningSchema.index({ tenantAdminEmail: 1 });

module.exports = mongoose.model("TenantProvisioning", tenantProvisioningSchema);
