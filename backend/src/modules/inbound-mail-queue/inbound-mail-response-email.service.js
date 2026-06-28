const env = require("../../config/env");
const notificationManager = require("../notifications/notification-manager.service");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sendAssignedEmail = async ({ to, senderName, ticketNumber, teamName, subject, adminNotes }) => {
  const notesBlock = adminNotes
    ? `<p><strong>Note from our team:</strong> ${escapeHtml(adminNotes)}</p>`
    : "";

  return notificationManager.sendEmail({
    to,
    subject: `Your support request — ticket ${ticketNumber}`,
    html: `
      <p>Hi ${escapeHtml(senderName || to)},</p>
      <p>We received your email regarding "<em>${escapeHtml(subject)}</em>" and have created support ticket <strong>${escapeHtml(ticketNumber)}</strong>.</p>
      <p>Your request has been assigned to <strong>${escapeHtml(teamName)}</strong>. Our team will follow up with you on this thread.</p>
      ${notesBlock}
      <p>Please reply to this email to add more information to your ticket.</p>
      <p>— ELVA Support</p>
    `,
    from: env.email.supportAddress,
    replyTo: env.email.supportAddress
  });
};

const sendRejectedEmail = async ({ to, senderName, subject, reason }) => {
  return notificationManager.sendEmail({
    to,
    subject: `Regarding your email: ${subject}`,
    html: `
      <p>Hi ${escapeHtml(senderName || to)},</p>
      <p>Thank you for contacting ELVA Support about "<em>${escapeHtml(subject)}</em>".</p>
      <p>After review, we are unable to process your request at this time for the following reason:</p>
      <blockquote style="border-left:3px solid #cbd5e1;padding-left:12px;color:#334155;">
        ${escapeHtml(reason)}
      </blockquote>
      <p>If you believe this was a mistake, please reply to this email with more details or contact us from your registered merchant email.</p>
      <p>— ELVA Support</p>
    `,
    from: env.email.supportAddress,
    replyTo: env.email.supportAddress
  });
};

module.exports = {
  sendAssignedEmail,
  sendRejectedEmail
};
