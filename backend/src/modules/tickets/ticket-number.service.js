const TicketSequence = require("./ticket-sequence.model");

const generateTicketNumber = async (applicationCode) => {
  const year = new Date().getFullYear();
  const code = applicationCode.toUpperCase();

  const sequence = await TicketSequence.findOneAndUpdate(
    { applicationCode: code, year },
    { $inc: { lastNumber: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const padded = String(sequence.lastNumber).padStart(6, "0");
  return `${code}-${year}-${padded}`;
};

module.exports = { generateTicketNumber };
