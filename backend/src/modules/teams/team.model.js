const mongoose = require("mongoose");
const { tenantIdField } = require("../../shared/schema/tenant-id.field");

const teamSchema = new mongoose.Schema(
  {
    tenantId: tenantIdField,
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true
    },
    moduleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Module"
      }
    ],
    teamLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

teamSchema.index({ applicationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Team", teamSchema);
