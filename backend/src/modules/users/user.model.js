const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, ALL_ROLES } = require("../../shared/constants/roles");
const { tenantIdField } = require("../../shared/schema/tenant-id.field");
const {
  USER_STATUSES,
  ALL_USER_STATUSES,
  isActiveFlagForStatus
} = require("../../shared/constants/user-lifecycle");

const userSchema = new mongoose.Schema(
  {
    tenantId: tenantIdField,
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      required: true
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
    },
    applicationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Application"
      }
    ],
    /**
     * Lifecycle status (Phase 10). isActive is kept in sync for backward compatibility.
     */
    status: {
      type: String,
      enum: ALL_USER_STATUSES,
      default: USER_STATUSES.ACTIVE,
      required: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    /** When the agent last had zero active tickets — used for longest-idle auto-assign */
    availableSince: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      }
    }
  }
);

/** Tenant-scoped email uniqueness (Phase 6) — replaces global email unique */
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, status: 1 });

userSchema.virtual("fullName").get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.pre("save", async function hashPasswordAndSyncLifecycle(next) {
  if (this.isModified("status") && this.status) {
    this.isActive = isActiveFlagForStatus(this.status);
  } else if (this.isModified("isActive") && !this.isModified("status")) {
    // Legacy clients toggling isActive only
    if (this.isActive === true) {
      this.status = USER_STATUSES.ACTIVE;
    } else if (this.status === USER_STATUSES.ACTIVE || !this.status) {
      this.status = USER_STATUSES.DEACTIVATED;
    }
  }

  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
module.exports.ROLES = ROLES;
