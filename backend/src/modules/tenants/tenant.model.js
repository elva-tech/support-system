const mongoose = require("mongoose");
const {
  ALL_TENANT_STATUSES,
  DEFAULT_TENANT_STATUS,
  TENANT_SLUG_PATTERN
} = require("../../shared/constants/tenant");

/**
 * Tenant = organization / company workspace (PaaS root).
 * Not the same as Application (product under a tenant).
 * Phase 2: additive only — existing entities do not reference tenantId yet.
 */
const tenantSettingsSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    branding: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    notifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => TENANT_SLUG_PATTERN.test(value),
        message:
          "slug must be lowercase alphanumeric with optional hyphens (a-z, 0-9, hyphen)"
      }
    },
    status: {
      type: String,
      enum: ALL_TENANT_STATUSES,
      default: DEFAULT_TENANT_STATUS,
      required: true
    },
    settings: {
      type: tenantSettingsSchema,
      default: () => ({
        organization: {},
        branding: {},
        notifications: {}
      })
    }
  },
  { timestamps: true, collection: "tenants" }
);

tenantSchema.index({ status: 1 });

module.exports = mongoose.model("Tenant", tenantSchema);
