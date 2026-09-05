const mongoose = require("mongoose");
const {
  ALL_TENANT_STATUSES,
  DEFAULT_TENANT_STATUS,
  TENANT_SLUG_PATTERN
} = require("../../shared/constants/tenant");
const {
  ALL_WORKSPACE_SETUP_STATUSES,
  WORKSPACE_SETUP_STATUSES,
  defaultSetupSteps,
  defaultWorkspaceSetup
} = require("../../shared/constants/workspace-setup");

/**
 * Tenant = organization / company workspace (PaaS root).
 * Not the same as Application (product under a tenant).
 *
 * settings.organization / branding / notifications remain Mixed for forward
 * compatibility; Phase 9 documents expected shapes and validates on write.
 *
 * setup = workspace configuration progress (distinct from TenantProvisioning).
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
    /** Phase 12 — support identity / customer terminology (presentation only) */
    support: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    notifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    /** Priorities, SLA policies, escalation, business hours */
    serviceManagement: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  { _id: false }
);

const setupStepsSchema = new mongoose.Schema(
  {
    organization: { type: Boolean, default: false },
    branding: { type: Boolean, default: false },
    team: { type: Boolean, default: false },
    application: { type: Boolean, default: false },
    users: { type: Boolean, default: false },
    client: { type: Boolean, default: false }
  },
  { _id: false }
);

const setupSkippedSchema = new mongoose.Schema(
  {
    branding: { type: Boolean, default: false },
    users: { type: Boolean, default: false },
    client: { type: Boolean, default: false }
  },
  { _id: false }
);

const workspaceSetupSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ALL_WORKSPACE_SETUP_STATUSES,
      default: WORKSPACE_SETUP_STATUSES.NOT_STARTED
    },
    steps: {
      type: setupStepsSchema,
      default: () => defaultSetupSteps()
    },
    skipped: {
      type: setupSkippedSchema,
      default: () => ({ branding: false, users: false, client: false })
    },
    completedAt: {
      type: Date,
      default: null
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
        support: {},
        notifications: {}
      })
    },
    setup: {
      type: workspaceSetupSchema,
      default: () => defaultWorkspaceSetup()
    }
  },
  { timestamps: true, collection: "tenants" }
);

tenantSchema.index({ status: 1 });
tenantSchema.index({ "setup.status": 1 });

module.exports = mongoose.model("Tenant", tenantSchema);
