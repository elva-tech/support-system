const mongoose = require("mongoose");
const { ALL_TICKET_STATUSES, TICKET_STATUSES } = require("../../shared/constants/ticket-statuses");
const {
  CONVERSATION_SOURCES,
  ACTIVE_CONVERSATION_SOURCES
} = require("../../shared/constants/communication-channels");
const { tenantIdField } = require("../../shared/schema/tenant-id.field");
const {
  ALL_TICKET_PRIORITIES,
  TICKET_PRIORITIES,
  SLA_CLOCK_STATES
} = require("../../shared/constants/service-management");

const slaCycleSchema = new mongoose.Schema(
  {
    cycleNumber: { type: Number, default: 1 },
    priority: { type: String, enum: ALL_TICKET_PRIORITIES },
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
    /** Idempotent escalation keys: `${metric}:${thresholdPercent}` */
    triggeredThresholds: { type: [String], default: [] },
    outcome: { type: String, default: null }
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    tenantId: tenantIdField,
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true
    },
    applicationCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: true
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantProfile",
      required: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ALL_TICKET_STATUSES,
      default: TICKET_STATUSES.OPEN
    },
    priority: {
      type: String,
      enum: ALL_TICKET_PRIORITIES,
      default: TICKET_PRIORITIES.MEDIUM
    },
    source: {
      type: String,
      enum: [...ACTIVE_CONVERSATION_SOURCES, ...Object.values(CONVERSATION_SOURCES)],
      default: CONVERSATION_SOURCES.PORTAL
    },
    channelMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    closureNotes: {
      type: String,
      default: null,
      trim: true,
      maxlength: 5000
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    },
    previousAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    closedAt: { type: Date, default: null },
    closedByMerchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantProfile",
      default: null
    },
    reopenedAt: { type: Date, default: null },
    sla: {
      currentCycle: { type: slaCycleSchema, default: null },
      history: { type: [slaCycleSchema], default: [] }
    }
  },
  { timestamps: true }
);

ticketSchema.index({ merchantId: 1, createdAt: -1 });
ticketSchema.index({ teamId: 1, status: 1 });
ticketSchema.index({ applicationCode: 1, createdAt: -1 });
ticketSchema.index({ teamId: 1, assignedTo: 1, status: 1, createdAt: 1 });
ticketSchema.index({ tenantId: 1, "sla.currentCycle.resolutionDueAt": 1, status: 1 });
ticketSchema.index({ subject: "text" });

module.exports = mongoose.model("Ticket", ticketSchema);
