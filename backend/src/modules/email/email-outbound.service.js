const notificationManager = require("../notifications/notification-manager.service");
const { EMAIL_DIRECTION } = require("../../shared/constants/communication-channels");
const emailThreadService = require("./email-thread.service");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const { renderTicketReplyEmail, renderTicketCreatedEmail } = require("../notifications/email-templates");
const {
  resolveTenantIdFromTicket,
  loadTenantById,
  buildEmailBranding
} = require("../../shared/utils/tenant-ops.util");

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

  const tenantId = ticket.tenantId || (await resolveTenantIdFromTicket(ticket));
  const tenant = await loadTenantById(tenantId);
  const branding = buildEmailBranding(tenant);

  const ticketNumber = ticket.ticketNumber;
  const messageId = emailThreadService.generateMessageId(ticketNumber);
  const threadContext = await emailThreadService.getThreadContext(ticket._id);

  const subject = isNewTicket
    ? `${emailThreadService.formatTicketTag(ticketNumber)} ${ticket.subject}`
    : emailThreadService.buildThreadedSubject(ticketNumber, ticket.subject);

  const html = isNewTicket
    ? renderTicketCreatedEmail({
        ticketNumber,
        subject: ticket.subject,
        merchantName: merchant.merchantName,
        message,
        senderName,
        ticket,
        branding
      })
    : renderTicketReplyEmail({
        senderName,
        senderType,
        message,
        ticketNumber,
        branding
      });

  const headers = {
    "Message-ID": messageId,
    ...(threadContext.inReplyTo ? { "In-Reply-To": threadContext.inReplyTo } : {}),
    ...(threadContext.references?.length
      ? { References: threadContext.references.join(" ") }
      : {})
  };

  const fromDisplay = `${branding.supportDisplayName} <${env.email.supportAddress}>`;

  const result = await notificationManager.sendEmail({
    to: merchant.email,
    subject,
    html,
    headers,
    replyTo: env.email.supportAddress,
    from: fromDisplay,
    tenantId
  });

  if (result.success) {
    await emailThreadService.recordThreadMessage({
      tenantId,
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
      tenantId: tenantId ? tenantId.toString() : null,
      error: result.error
    });
  }

  return result;
};

module.exports = { sendTimelineEmail };
