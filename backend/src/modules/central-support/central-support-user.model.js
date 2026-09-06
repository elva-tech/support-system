const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const {
  ALL_CENTRAL_SUPPORT_ROLES,
  CENTRAL_SUPPORT_ROLES,
  ALL_CENTRAL_SUPPORT_USER_STATUSES,
  CENTRAL_SUPPORT_USER_STATUSES
} = require("../../shared/constants/central-support");

const centralSupportUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: ALL_CENTRAL_SUPPORT_ROLES,
      required: true,
      default: CENTRAL_SUPPORT_ROLES.CENTRAL_SUPPORT_AGENT
    },
    status: {
      type: String,
      enum: ALL_CENTRAL_SUPPORT_USER_STATUSES,
      required: true,
      default: CENTRAL_SUPPORT_USER_STATUSES.ACTIVE
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentralSupportTeam",
      default: null,
      index: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CentralSupportUser",
      default: null
    }
  },
  {
    timestamps: true,
    collection: "centralsupportusers",
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      }
    }
  }
);

centralSupportUserSchema.index({ status: 1, role: 1 });
centralSupportUserSchema.index({ teamId: 1, status: 1 });

centralSupportUserSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

centralSupportUserSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("CentralSupportUser", centralSupportUserSchema);
