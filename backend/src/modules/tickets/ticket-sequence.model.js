const mongoose = require("mongoose");
const { tenantIdField } = require("../../shared/schema/tenant-id.field");

const ticketSequenceSchema = new mongoose.Schema(
  {
    tenantId: tenantIdField,
    applicationCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    year: {
      type: Number,
      required: true
    },
    lastNumber: {
      type: Number,
      required: true,
      default: 0
    }
  },
  { timestamps: true }
);

// Tenant-aware uniqueness (Phase 4). Legacy applicationCode+year unique is dropped by migration.
ticketSequenceSchema.index({ tenantId: 1, applicationCode: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("TicketSequence", ticketSequenceSchema);
