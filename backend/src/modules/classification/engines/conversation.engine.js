const TICKET_NUMBER_PATTERN = /\b([A-Z]{2,10})-(\d{4})-(\d{6})\b/i;

const normalizeText = (value) => String(value || "").trim();

const extractTicketReference = (subject, body) => {
  const combined = `${subject} ${body}`;
  const match = combined.match(TICKET_NUMBER_PATTERN);
  return match ? match[0].toUpperCase() : null;
};

/**
 * Normalizes inbound conversation payloads (email-like) before classification.
 * Does not connect to IMAP/SMTP — structure only.
 */
class ConversationEngine {
  parse(input = {}) {
    const senderEmail = normalizeText(input.senderEmail).toLowerCase();
    const subject = normalizeText(input.subject);
    const body = normalizeText(input.body);
    const ticketReference = extractTicketReference(subject, body);

    return {
      senderEmail,
      subject,
      body,
      subjectLower: subject.toLowerCase(),
      bodyLower: body.toLowerCase(),
      ticketReference,
      combinedLower: `${subject} ${body}`.toLowerCase()
    };
  }
}

module.exports = new ConversationEngine();
