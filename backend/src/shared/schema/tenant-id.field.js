const mongoose = require("mongoose");

/**
 * Optional tenant ownership field for Phase 3+.
 * Not required yet — creation paths and request isolation land in later phases.
 */
const tenantIdField = {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Tenant",
  default: null,
  index: true
};

module.exports = { tenantIdField };
