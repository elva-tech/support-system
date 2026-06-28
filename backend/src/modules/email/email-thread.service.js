const EmailThread = require("./email-thread.model");

const formatTicketTag = (ticketNumber) => `[${ticketNumber}]`;

const buildThreadedSubject = (ticketNumber, subject = "") => {
  const tag = formatTicketTag(ticketNumber);
  const clean = String(subject).replace(new RegExp(`\\${tag}`, "g"), "").trim();
  if (clean.toLowerCase().startsWith("re:")) {
    return clean.includes(tag) ? clean : `${clean} ${tag}`.trim();
  }
  return `Re: ${clean || "Support request"} ${tag}`.trim();
};

const generateMessageId = (ticketNumber) => {
  const domain = "elvatech.in";
  return `<${ticketNumber.replace(/[^a-zA-Z0-9-]/g, "")}.${Date.now()}@${domain}>`;
};

const recordThreadMessage = async ({
  ticketId,
  conversationId,
  messageId,
  inReplyTo,
  references,
  direction,
  subject,
  fromEmail,
  toEmail
}) =>
  EmailThread.create({
    ticketId,
    conversationId,
    messageId,
    inReplyTo: inReplyTo || null,
    references: references || [],
    direction,
    subject,
    fromEmail,
    toEmail
  });

const getLatestOutboundMessageId = async (ticketId) => {
  const latest = await EmailThread.findOne({ ticketId, direction: "OUTBOUND" })
    .sort({ createdAt: -1 })
    .select("messageId references");

  return latest;
};

const getThreadContext = async (ticketId) => {
  const latest = await getLatestOutboundMessageId(ticketId);
  const inbound = await EmailThread.findOne({ ticketId, direction: "INBOUND" })
    .sort({ createdAt: -1 })
    .select("messageId references");

  const anchor = latest || inbound;
  if (!anchor) {
    return { inReplyTo: null, references: [] };
  }

  const references = [...new Set([...(anchor.references || []), anchor.messageId].filter(Boolean))];
  return {
    inReplyTo: anchor.messageId,
    references
  };
};

const findByMessageId = (messageId) => EmailThread.findOne({ messageId });

const normalizeMessageId = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const inner = trimmed.replace(/^<|>$/g, "");
  return `<${inner}>`;
};

const normalizeMessageIds = (inReplyTo, references = []) => {
  const refs = Array.isArray(references) ? references : references ? [references] : [];
  const raw = [inReplyTo, ...refs].filter(Boolean);
  const normalized = raw.map(normalizeMessageId).filter(Boolean);
  const unwrapped = raw.map((value) => String(value).trim().replace(/^<|>$/g, ""));
  return [...new Set([...normalized, ...unwrapped])];
};

const findTicketIdByThreadHeaders = async (inReplyTo, references = []) => {
  const messageIds = normalizeMessageIds(inReplyTo, references);
  if (!messageIds.length) {
    return null;
  }

  const thread = await EmailThread.findOne({
    $or: [{ messageId: { $in: messageIds } }, { inReplyTo: { $in: messageIds } }]
  })
    .sort({ createdAt: -1 })
    .select("ticketId");

  return thread?.ticketId || null;
};

module.exports = {
  formatTicketTag,
  buildThreadedSubject,
  generateMessageId,
  recordThreadMessage,
  getThreadContext,
  findByMessageId,
  findTicketIdByThreadHeaders
};
