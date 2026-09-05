const mongoose = require("mongoose");
const { tenantIdField } = require("../../shared/schema/tenant-id.field");

const applicationSchema = new mongoose.Schema(
  {
    tenantId: tenantIdField,
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
      // Uniqueness is tenant-scoped: { tenantId: 1, code: 1 }
    },
    description: {
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

applicationSchema.index({ tenantId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Application", applicationSchema);
