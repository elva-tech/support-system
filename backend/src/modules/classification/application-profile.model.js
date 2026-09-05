const mongoose = require("mongoose");
const { DEFAULT_CONFIDENCE_THRESHOLD } = require("../../shared/constants/classification");
const { tenantIdField } = require("../../shared/schema/tenant-id.field");

const moduleKeywordSchema = new mongoose.Schema(
  {
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
      required: true
    },
    keywords: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const applicationProfileSchema = new mongoose.Schema(
  {
    tenantId: tenantIdField,
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true
    },
    keywords: {
      type: [String],
      default: []
    },
    modules: {
      type: [moduleKeywordSchema],
      default: []
    },
    confidenceThreshold: {
      type: Number,
      default: DEFAULT_CONFIDENCE_THRESHOLD,
      min: 0,
      max: 1
    }
  },
  { timestamps: true, collection: "application_profiles" }
);

module.exports = mongoose.model("ApplicationProfile", applicationProfileSchema);
