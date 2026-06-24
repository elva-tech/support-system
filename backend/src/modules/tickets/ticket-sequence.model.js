const mongoose = require("mongoose");

const ticketSequenceSchema = new mongoose.Schema(
  {
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

ticketSequenceSchema.index({ applicationCode: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("TicketSequence", ticketSequenceSchema);
