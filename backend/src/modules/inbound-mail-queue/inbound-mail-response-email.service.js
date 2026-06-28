const env = require("../../config/env");
const notificationManager = require("../notifications/notification-manager.service");
const { renderInboundAssignedEmail, renderInboundRejectedEmail } = require("../notifications/email-templates");

const sendAssignedEmail = async ({ to, senderName, ticketNumber, teamName, subject, adminNotes }) =>
  notificationManager.sendEmail({
    to,
    subject: `Your support request — ticket ${ticketNumber}`,
    html: renderInboundAssignedEmail({
      senderName,
      to,
      ticketNumber,
      teamName,
      subject,
      adminNotes
    }),
    from: env.email.supportAddress,
    replyTo: env.email.supportAddress
  });

const sendRejectedEmail = async ({ to, senderName, subject, reason }) =>
  notificationManager.sendEmail({
    to,
    subject: `Regarding your email: ${subject}`,
    html: renderInboundRejectedEmail({
      senderName,
      to,
      subject,
      reason
    }),
    from: env.email.supportAddress,
    replyTo: env.email.supportAddress
  });

module.exports = {
  sendAssignedEmail,
  sendRejectedEmail
};
