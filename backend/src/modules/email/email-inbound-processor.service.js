const env = require("../../config/env");
const omnichannelEngine = require("../omnichannel/conversation-engine.service");
const emailThreadService = require("./email-thread.service");
const {
  mapEmailAttachments,
  extractReplyBody,
  normalizeReferences,
  isAddressedToSupport
} = require("./email-content.util");
const { CONVERSATION_SOURCES, EMAIL_DIRECTION } = require("../../shared/constants/communication-channels");

const processParsedEmail = async (parsed, sourceRef, { requireSupportRecipient }) => {
  if (requireSupportRecipient && !isAddressedToSupport(parsed)) {
    return { action: "SKIPPED", reason: "NOT_SUPPORT_ALIAS" };
  }

  const fromAddress = parsed.from?.value?.[0]?.address || "";
  const senderName = parsed.from?.value?.[0]?.name || "";
  const messageId = parsed.messageId || `<inbound-${sourceRef}@local>`;

  if (await emailThreadService.findByMessageId(messageId)) {
    return { status: "DUPLICATE", messageId };
  }

  const replyBody = extractReplyBody(parsed);
  const attachments = mapEmailAttachments(parsed);
  const references = normalizeReferences(parsed.references);
  const inReplyTo = parsed.inReplyTo ? String(parsed.inReplyTo).trim() : null;

  const result = await omnichannelEngine.processInbound({
    source: CONVERSATION_SOURCES.EMAIL,
    senderEmail: fromAddress,
    senderName,
    subject: parsed.subject || "(No subject)",
    body:
      replyBody ||
      (attachments.length ? "Sent attachments via email" : parsed.subject || "(No message body)"),
    attachments,
    externalMessageId: messageId,
    channelMetadata: {
      messageId,
      inReplyTo,
      references,
      inboundSourceRef: sourceRef
    }
  });

  if (result.action === "REPLY" || result.action === "CREATED") {
    await emailThreadService.recordThreadMessage({
      ticketId: result.ticketId,
      conversationId: result.conversationId || null,
      messageId,
      inReplyTo,
      references,
      direction: EMAIL_DIRECTION.INBOUND,
      subject: parsed.subject || "",
      fromEmail: fromAddress,
      toEmail: env.email.supportAddress
    });
  }

  return result;
};

module.exports = {
  processParsedEmail
};
