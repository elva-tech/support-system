const mongoose = require("mongoose");

const otpSessionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    /**
     * Phase 15: bind OTP sessions to tenant so same email across tenants cannot cross-verify.
     */
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true
    },
    otpCode: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    attemptCount: {
      type: Number,
      default: 0
    },
    lockedUntil: {
      type: Date,
      default: null
    },
    usesExternalOtp: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

otpSessionSchema.index({ email: 1, tenantId: 1, createdAt: -1 });
otpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OtpSession", otpSessionSchema);
