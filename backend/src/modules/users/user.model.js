const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, ALL_ROLES } = require("../../shared/constants/roles");

const userSchema = new mongoose.Schema(
  {
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

userSchema.virtual("fullName").get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.pre("save", async function hashPassword(next) {
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
