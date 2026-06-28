const notificationManager = require("../notifications/notification-manager.service");
const { EMAIL_DIRECTION } = require("../../shared/constants/communication-channels");
const emailThreadService = require("./email-thread.service");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sendTimelineEmail = async ({
  ticket,
  merchant,
  message,
  senderName,
  senderType,
  conversationId,
  isNewTicket = false
}) => {
  if (!merchant?.email) {
    return { success: false, error: "Merchant email not available" };
  }

  const ticketNumber = ticket.ticketNumber;
  const messageId = emailThreadService.generateMessageId(ticketNumber);
  const threadContext = await emailThreadService.getThreadContext(ticket._id);

  const subject = isNewTicket
    ? `${emailThreadService.formatTicketTag(ticketNumber)} ${ticket.subject}`
    : emailThreadService.buildThreadedSubject(ticketNumber, ticket.subject);

  const html = `
    <p>${escapeHtml(senderName)} (${escapeHtml(senderType)}) wrote:</p>
    <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
    <hr/>
    <p style="color:#64748b;font-size:12px;">Ticket ${escapeHtml(ticketNumber)} — ELVA Support</p>
  `;

  const headers = {
    "Message-ID": messageId,
    ...(threadContext.inReplyTo ? { "In-Reply-To": threadContext.inReplyTo } : {}),
    ...(threadContext.references?.length
      ? { References: threadContext.references.join(" ") }
      : {})
  };

  const result = await notificationManager.sendEmail({
    to: merchant.email,
    subject,
    html,
    headers,
    replyTo: env.email.supportAddress,
    from: env.email.supportAddress
  });

  if (result.success) {
    await emailThreadService.recordThreadMessage({
      ticketId: ticket._id,
      conversationId,
      messageId,
      inReplyTo: threadContext.inReplyTo,
      references: threadContext.references,
      direction: EMAIL_DIRECTION.OUTBOUND,
      subject,
      fromEmail: env.email.supportAddress,
      toEmail: merchant.email
    });
  } else {
    logger.warn("Timeline email delivery failed", {
      ticketNumber,
      error: result.error
    });
  }

  return result;
};

module.exports = { sendTimelineEmail };
