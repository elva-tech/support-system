const mongoose = require("mongoose");
const { tenantIdField } = require("../../shared/schema/tenant-id.field");

const merchantSessionSchema = new mongoose.Schema(
  {
    tenantId: tenantIdField,
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantProfile",
      required: true,
      index: true
    },
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

merchantSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("MerchantSession", merchantSessionSchema);
