const mongoose = require("mongoose");
const { CLASSIFICATION_QUEUE_STATUS } = require("../../shared/constants/classification");

const classificationQueueSchema = new mongoose.Schema(
  {
    senderEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      default: "",
      trim: true
    },
    ticketReference: {
      type: String,
      default: null,
      trim: true,
      uppercase: true
    },
    isExistingTicket: {
      type: Boolean,
      default: false
    },
    existingTicketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null
    },
    suggestedApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null
    },
    suggestedModuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      default: null
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    matchedBy: {
      type: String,
      default: null
    },
    requiresManualClassification: {
      type: Boolean,
      default: true
    },
    classificationResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    status: {
      type: String,
      enum: Object.values(CLASSIFICATION_QUEUE_STATUS),
      default: CLASSIFICATION_QUEUE_STATUS.PENDING
    },
    resolvedApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null
    },
    resolvedModuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      default: null
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolutionNotes: {
      type: String,
      default: ""
    }
  },
  { timestamps: true, collection: "classification_queue" }
);

classificationQueueSchema.index({ status: 1, createdAt: -1 });
classificationQueueSchema.index({ senderEmail: 1, createdAt: -1 });

module.exports = mongoose.model("ClassificationQueue", classificationQueueSchema);
