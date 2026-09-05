const TicketSequence = require("./ticket-sequence.model");

/**
 * Atomically allocate the next ticket number for a tenant + application + year.
 * Uniqueness key: (tenantId, applicationCode, year)
 */
const generateTicketNumber = async (applicationCode, tenantId) => {
  if (!tenantId) {
    throw new Error("tenantId is required to generate a ticket number");
  }

  const year = new Date().getFullYear();
  const code = applicationCode.toUpperCase();

  const sequence = await TicketSequence.findOneAndUpdate(
    { tenantId, applicationCode: code, year },
    {
      $inc: { lastNumber: 1 },
      $setOnInsert: { tenantId, applicationCode: code, year }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const padded = String(sequence.lastNumber).padStart(6, "0");
  return `${code}-${year}-${padded}`;
};

module.exports = { generateTicketNumber };
