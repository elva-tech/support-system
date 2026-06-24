const mongoose = require("mongoose");

const moduleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    defaultTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

moduleSchema.index({ applicationId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Module", moduleSchema);
