const mongoose = require("mongoose");

const otpSessionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
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

otpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OtpSession", otpSessionSchema);
