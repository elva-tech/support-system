const { escapeHtml, nl2br } = require("./escape");
const {
  renderEmailLayout,
  renderParagraph,
  renderCtaButton,
  renderCodeBlock,
  renderInfoBox,
  renderQuote,
  getFrontendUrl,
  MUTED
} = require("./layout");

const renderOtpEmail = ({ otp, expiresInMinutes }) =>
  renderEmailLayout({
    heroTitle: "Verify your email address",
    heroSubtitle: "Merchant sign-in",
    preheader: `Your ELVA Support verification code is ${otp}`,
    bodyHtml: `
      ${renderParagraph("Hello,")}
      ${renderParagraph("Use the verification code below to sign in to the ELVA Support merchant portal. This code is valid for a limited time.")}
      ${renderCodeBlock(otp)}
      ${renderParagraph(`<span style="color:${MUTED};font-size:14px;">This code expires in <strong>${escapeHtml(expiresInMinutes)} minutes</strong>. If you did not request this code, you can safely ignore this email.</span>`)}
    `
  });

const renderNotificationEmail = ({ subject, body, merchantName }) =>
  renderEmailLayout({
    heroTitle: subject,
    heroSubtitle: "Ticket update",
    preheader: body,
    bodyHtml: `
      ${renderParagraph(`Dear ${escapeHtml(merchantName || "Customer")},`)}
      ${renderParagraph(escapeHtml(body))}
      ${renderCtaButton("Open merchant portal", `${getFrontendUrl()}/merchant/login`)}
    `
  });

const renderTicketReplyEmail = ({ senderName, senderType, message, ticketNumber }) =>
  renderEmailLayout({
    heroTitle: `Update on ticket ${ticketNumber}`,
    heroSubtitle: "Support conversation",
    preheader: message.slice(0, 120),
    bodyHtml: `
      ${renderParagraph(`<strong>${escapeHtml(senderName)}</strong> <span style="color:${MUTED};">(${escapeHtml(senderType)})</span> wrote:`)}
      ${renderInfoBox(nl2br(message))}
      ${renderParagraph(`<span style="font-size:13px;color:${MUTED};">Reply to this email to continue the conversation on ticket <strong>${escapeHtml(ticketNumber)}</strong>.</span>`)}
    `
  });

const renderStaffWelcomeEmail = ({ firstName, applicationName, teamName, email, plainPassword }) => {
  const loginUrl = `${getFrontendUrl()}/auth/login`;
  const appTeamLine =
    applicationName && teamName
      ? renderParagraph(
          `You have been added to <strong>${escapeHtml(applicationName)}</strong> — <strong>${escapeHtml(teamName)}</strong>.`
        )
      : "";

  return renderEmailLayout({
    heroTitle: "Your account is ready",
    heroSubtitle: "Staff welcome",
    bodyHtml: `
      ${renderParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${renderParagraph("Your ELVA Support staff account has been created. Use the credentials below to sign in.")}
      ${appTeamLine}
      ${renderInfoBox(`
        <strong>Email:</strong> ${escapeHtml(email)}<br/>
        <strong>Password:</strong> ${escapeHtml(plainPassword)}
      `)}
      ${renderCtaButton("Sign in to ELVA Support", loginUrl)}
      ${renderParagraph(`<span style="font-size:14px;color:${MUTED};">Please change your password after your first login if your organization requires it.</span>`)}
    `
  });
};

const renderStaffPasswordUpdatedEmail = ({ firstName, email, plainPassword }) => {
  const loginUrl = `${getFrontendUrl()}/auth/login`;

  return renderEmailLayout({
    heroTitle: "Password updated",
    heroSubtitle: "Account security",
    bodyHtml: `
      ${renderParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${renderParagraph("Your ELVA Support password was updated by an administrator.")}
      ${renderInfoBox(`
        <strong>Email:</strong> ${escapeHtml(email)}<br/>
        <strong>New password:</strong> ${escapeHtml(plainPassword)}
      `)}
      ${renderCtaButton("Sign in to ELVA Support", loginUrl)}
      ${renderParagraph(`<span style="font-size:14px;color:${MUTED};">If you did not expect this change, contact your administrator immediately.</span>`)}
    `
  });
};

const renderMerchantWelcomeEmail = ({ merchantName, appName, email, supportEmail }) => {
  const loginUrl = `${getFrontendUrl()}/merchant/login`;

  return renderEmailLayout({
    heroTitle: `Welcome to ELVA Support`,
    heroSubtitle: appName,
    bodyHtml: `
      ${renderParagraph(`Dear ${escapeHtml(merchantName)},`)}
      ${renderParagraph(`Welcome to <strong>ELVA Support</strong>. You now have access to our customer support portal for <strong>${escapeHtml(appName)}</strong>.`)}
      ${renderParagraph("Our customers are at the heart of everything we do — we are always ready to support you.")}
      ${renderParagraph(`To raise any query about <strong>${escapeHtml(appName)}</strong>, sign in with your registered email. We will send a one-time verification code to confirm it is you.`)}
      ${renderInfoBox(`
        <strong>Your email:</strong> ${escapeHtml(email)}<br/>
        <strong>Support:</strong> <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4a6789;">${escapeHtml(supportEmail)}</a>
      `)}
      ${renderCtaButton("Go to merchant portal", loginUrl)}
    `
  });
};

const renderInboundAssignedEmail = ({ senderName, to, ticketNumber, teamName, subject, adminNotes }) => {
  const notesBlock = adminNotes
    ? renderParagraph(`<strong>Note from our team:</strong> ${escapeHtml(adminNotes)}`)
    : "";

  return renderEmailLayout({
    heroTitle: `Ticket ${ticketNumber} created`,
    heroSubtitle: "We received your email",
    bodyHtml: `
      ${renderParagraph(`Hi ${escapeHtml(senderName || to)},`)}
      ${renderParagraph(`We received your email regarding "<em>${escapeHtml(subject)}</em>" and have created support ticket <strong>${escapeHtml(ticketNumber)}</strong>.`)}
      ${renderParagraph(`Your request has been assigned to <strong>${escapeHtml(teamName)}</strong>. Our team will follow up with you on this thread.`)}
      ${notesBlock}
      ${renderParagraph(`<span style="font-size:14px;color:${MUTED};">Please reply to this email to add more information to your ticket.</span>`)}
    `
  });
};

const renderInboundRejectedEmail = ({ senderName, to, subject, reason }) =>
  renderEmailLayout({
    heroTitle: "Regarding your request",
    heroSubtitle: "ELVA Support",
    bodyHtml: `
      ${renderParagraph(`Hi ${escapeHtml(senderName || to)},`)}
      ${renderParagraph(`Thank you for contacting ELVA Support about "<em>${escapeHtml(subject)}</em>".`)}
      ${renderParagraph("After review, we are unable to process your request at this time for the following reason:")}
      ${renderQuote(reason)}
      ${renderParagraph("If you believe this was a mistake, please reply to this email with more details or contact us from your registered merchant email.")}
    `
  });

const renderTeamLeadAlertEmail = ({ firstName, ticketNumber, subject, reasonLine, ticketUrl }) =>
  renderEmailLayout({
    heroTitle: "Ticket needs assignment",
    heroSubtitle: "Action needed",
    bodyHtml: `
      ${renderParagraph(`Hi ${escapeHtml(firstName)},`)}
      ${renderParagraph(`Ticket <strong>${escapeHtml(ticketNumber)}</strong> — "<em>${escapeHtml(subject)}</em>" is waiting in your team queue.`)}
      ${renderParagraph(escapeHtml(reasonLine))}
      ${renderCtaButton("Open ticket", ticketUrl)}
    `
  });

module.exports = {
  renderOtpEmail,
  renderNotificationEmail,
  renderTicketReplyEmail,
  renderStaffWelcomeEmail,
  renderStaffPasswordUpdatedEmail,
  renderMerchantWelcomeEmail,
  renderInboundAssignedEmail,
  renderInboundRejectedEmail,
  renderTeamLeadAlertEmail
};
