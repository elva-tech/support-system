const mongoose = require("mongoose");
const {
  ALL_PLATFORM_SUPPORT_STATUSES,
  ALL_PLATFORM_SUPPORT_PRIORITIES,
  PLATFORM_SUPPORT_CATEGORIES,
  PLATFORM_SUPPORT_STATUSES,
  PLATFORM_SUPPORT_PRIORITIES
} = require("../../shared/constants/platform-support");
const { SLA_CLOCK_STATES } = require("../../shared/constants/service-management");

const slaCycleSchema = new mongoose.Schema(
  {
    cycleNumber: { type: Number, default: 1 },
    priority: { type: String, enum: ALL_PLATFORM_SUPPORT_PRIORITIES },
    startedAt: { type: Date },
    responseTargetMinutes: { type: Number },
    resolutionTargetMinutes: { type: Number },
    useBusinessHours: { type: Boolean, default: false },
    responseDueAt: { type: Date, default: null },
    resolutionDueAt: { type: Date, default: null },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    responseState: {
      type: String,
      enum: Object.values(SLA_CLOCK_STATES),
      default: SLA_CLOCK_STATES.ON_TRACK
    },
    resolutionState: {
      type: String,
      enum: Object.values(SLA_CLOCK_STATES),
      default: SLA_CLOCK_STATES.ON_TRACK
    },
    responseBreachedAt: { type: Date, default: null },
    resolutionBreachedAt: { type: Date, default: null },
    triggeredThresholds: { type: [String], default: [] },
    outcome: { type: String, default: null }
  },
  { _id: false }
);

const platformSupportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, trim: true, index: true },
    status: {
      type: String,
      enum: ALL_PLATFORM_SUPPORT_STATUSES,
      default: PLATFORM_SUPPORT_STATUSES.OPEN,
      index: true
    },
    priority: {
      type: String,
      enum: ALL_PLATFORM_SUPPORT_PRIORITIES,
      default: PLATFORM_SUPPORT_PRIORITIES.MEDIUM,
      index: true
    },
    category: {
      type: String,
      enum: PLATFORM_SUPPORT_CATEGORIES,
      required: true,
      index: true
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 10000 },

    sourceTenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },
    sourceTenantSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
    sourceOrganizationName: { type: String, required: true, trim: true },
    sourceWorkspaceUrl: { type: String, required: true, trim: true },

    raisedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    raisedByName: { type: String, required: true, trim: true },
    raisedByEmail: { type: String, required: true, lowercase: true, trim: true },
    raisedByRole: { type: String, required: true, trim: true },

    assignedCentralSupportUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentralSupportUser",
      default: null,
      index: true
    },
    assignedCentralSupportUserName: { type: String, default: null },
    assignedCentralSupportTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentralSupportTeam",
      default: null,
      index: true
    },
    assignedCentralSupportTeamName: { type: String, default: null },
    assignedAt: { type: Date, default: null },

    /** Legacy platform-admin assignment — cleared by migration; kept for read safety */
    assignedPlatformAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformAdmin",
      default: null
    },
    assignedPlatformAdminName: { type: String, default: null },

    sla: {
      currentCycle: { type: slaCycleSchema, default: null },
      previousCycles: { type: [slaCycleSchema], default: [] }
    },

    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "platformsupporttickets"
  }
);

platformSupportTicketSchema.index({ status: 1, createdAt: -1 });
platformSupportTicketSchema.index({ sourceTenantId: 1, createdAt: -1 });
platformSupportTicketSchema.index({ assignedCentralSupportUserId: 1, status: 1 });
platformSupportTicketSchema.index({ assignedCentralSupportTeamId: 1, status: 1 });
platformSupportTicketSchema.index({
  subject: "text",
  description: "text",
  sourceOrganizationName: "text",
  raisedByName: "text",
  raisedByEmail: "text",
  ticketNumber: "text"
});

module.exports = mongoose.model("PlatformSupportTicket", platformSupportTicketSchema);
