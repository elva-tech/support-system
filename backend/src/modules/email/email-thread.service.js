const EmailThread = require("./email-thread.model");
const { resolveTenantIdFromTicket } = require("../../shared/utils/tenant-ops.util");

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
  toEmail,
  tenantId = null
}) => {
  const resolvedTenantId = tenantId || (await resolveTenantIdFromTicket(ticketId));

  return EmailThread.create({
    ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
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
};

const getLatestOutboundMessageId = async (ticketId) => {
  const latest = await EmailThread.findOne({ ticketId, direction: "OUTBOUND" })
    .sort({ createdAt: -1 })
    .select("messageId references tenantId");

  return latest;
};

const getThreadContext = async (ticketId) => {
  const latest = await getLatestOutboundMessageId(ticketId);
  const inbound = await EmailThread.findOne({ ticketId, direction: "INBOUND" })
    .sort({ createdAt: -1 })
    .select("messageId references tenantId");

  const anchor = latest || inbound;
  if (!anchor) {
    return { inReplyTo: null, references: [], tenantId: null };
  }

  const references = [...new Set([...(anchor.references || []), anchor.messageId].filter(Boolean))];
  return {
    inReplyTo: anchor.messageId,
    references,
    tenantId: anchor.tenantId || null
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

/**
 * Resolve ticket from In-Reply-To / References.
 * Returns null when no match, or when headers ambiguously match multiple tenants.
 */
const findTicketContextByThreadHeaders = async (inReplyTo, references = []) => {
  const messageIds = normalizeMessageIds(inReplyTo, references);
  if (!messageIds.length) {
    return null;
  }

  const threads = await EmailThread.find({
    $or: [{ messageId: { $in: messageIds } }, { inReplyTo: { $in: messageIds } }]
  })
    .sort({ createdAt: -1 })
    .select("ticketId tenantId")
    .limit(20)
    .lean();

  if (!threads.length) {
    return null;
  }

  const tenantKeys = new Set(
    threads.map((thread) => (thread.tenantId ? thread.tenantId.toString() : "null"))
  );
  const ticketKeys = new Set(threads.map((thread) => thread.ticketId.toString()));

  if (tenantKeys.size > 1 || ticketKeys.size > 1) {
    return { ambiguous: true, ticketId: null, tenantId: null };
  }

  const primary = threads[0];
  let tenantId = primary.tenantId || null;
  if (!tenantId) {
    tenantId = await resolveTenantIdFromTicket(primary.ticketId);
  }

  return {
    ambiguous: false,
    ticketId: primary.ticketId,
    tenantId
  };
};

const findTicketIdByThreadHeaders = async (inReplyTo, references = []) => {
  const context = await findTicketContextByThreadHeaders(inReplyTo, references);
  if (!context || context.ambiguous) {
    return null;
  }
  return context.ticketId || null;
};

module.exports = {
  formatTicketTag,
  buildThreadedSubject,
  generateMessageId,
  recordThreadMessage,
  getThreadContext,
  findByMessageId,
  findTicketIdByThreadHeaders,
  findTicketContextByThreadHeaders
};
