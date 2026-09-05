const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const {
  ALL_PLATFORM_ROLES,
  PLATFORM_ROLES,
  ALL_PLATFORM_ADMIN_STATUSES,
  PLATFORM_ADMIN_STATUSES
} = require("../../shared/constants/platform");

const platformAdminSchema = new mongoose.Schema(
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
      enum: ALL_PLATFORM_ROLES,
      required: true,
      default: PLATFORM_ROLES.PLATFORM_ADMIN
    },
    status: {
      type: String,
      enum: ALL_PLATFORM_ADMIN_STATUSES,
      required: true,
      default: PLATFORM_ADMIN_STATUSES.ACTIVE
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformAdmin",
      default: null
    }
  },
  {
    timestamps: true,
    collection: "platformadmins",
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      }
    }
  }
);

platformAdminSchema.index({ status: 1, role: 1 });

platformAdminSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

platformAdminSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("PlatformAdmin", platformAdminSchema);
