const mongoose = require("mongoose");

const platformSupportSequenceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "ELVA" },
    seq: { type: Number, required: true, default: 0 }
  },
  { collection: "platformsupportsequences" }
);

module.exports = mongoose.model("PlatformSupportSequence", platformSupportSequenceSchema);
