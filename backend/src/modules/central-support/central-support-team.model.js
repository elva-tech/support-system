const mongoose = require("mongoose");

const centralSupportTeamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000
    },
    teamLeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentralSupportUser",
      default: null
    },
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CentralSupportUser"
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentralSupportUser",
      default: null
    }
  },
  {
    timestamps: true,
    collection: "centralsupportteams"
  }
);

centralSupportTeamSchema.index({ name: 1 }, { unique: true });
centralSupportTeamSchema.index({ isActive: 1 });

module.exports = mongoose.model("CentralSupportTeam", centralSupportTeamSchema);
