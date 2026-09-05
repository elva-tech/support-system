const mongoose = require("mongoose");
const { tenantIdField } = require("../../shared/schema/tenant-id.field");

const merchantProfileSchema = new mongoose.Schema(
  {
    tenantId: tenantIdField,
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true
    },
    applicationCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    externalUserId: {
      type: String,
      required: true,
      trim: true
    },
    merchantName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
      // Uniqueness is tenant-scoped: { tenantId: 1, email: 1 }
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

merchantProfileSchema.index({ tenantId: 1, email: 1 }, { unique: true });
merchantProfileSchema.index({ applicationId: 1, externalUserId: 1 }, { unique: true });
merchantProfileSchema.index({ applicationCode: 1, externalUserId: 1 }, { unique: true });

module.exports = mongoose.model("MerchantProfile", merchantProfileSchema);
