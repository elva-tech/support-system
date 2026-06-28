const notificationManager = require("./notification-manager.service");
const Team = require("../teams/team.model");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const getFrontendUrl = () => env.frontendUrl.replace(/\/$/, "");

const sendEmail = async ({ to, subject, html }) => {
  const result = await notificationManager.sendEmail({ to, subject, html });

  if (!result.success) {
    logger.warn("Onboarding email delivery failed", { to, subject, error: result.error });
  }

  return result;
};

const loadTeamContext = async (teamId) => {
  if (!teamId) {
    return { teamName: null, applicationName: null, applicationCode: null };
  }

  const team = await Team.findById(teamId).populate("applicationId", "name code");
  if (!team) {
    return { teamName: null, applicationName: null, applicationCode: null };
  }

  const app = team.applicationId;
  return {
    teamName: team.name,
    applicationName: typeof app === "object" ? app.name : null,
    applicationCode: typeof app === "object" ? app.code : null
  };
};

const sendStaffWelcomeEmail = async (user, plainPassword) => {
  const { teamName, applicationName } = await loadTeamContext(user.teamId);
  const loginUrl = `${getFrontendUrl()}/auth/login`;
  const appTeamLine =
    applicationName && teamName
      ? `<p>You have been added to <strong>${escapeHtml(applicationName)}</strong> — <strong>${escapeHtml(teamName)}</strong>.</p>`
      : "";

  const html = `
    <p>Hi ${escapeHtml(user.firstName)},</p>
    <p>Your ELVA Support staff account is ready.</p>
    ${appTeamLine}
    <p><strong>Sign in here:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>Email:</strong> ${escapeHtml(user.email)}<br/>
    <strong>Password:</strong> ${escapeHtml(plainPassword)}</p>
    <p>Please change your password after your first login if your organization requires it.</p>
    <p>— ELVA Support</p>
  `;

  return sendEmail({
    to: user.email,
    subject: "Welcome to ELVA Support — your account is ready",
    html
  });
};

const sendStaffPasswordUpdatedEmail = async (user, plainPassword) => {
  const loginUrl = `${getFrontendUrl()}/auth/login`;

  const html = `
    <p>Hi ${escapeHtml(user.firstName)},</p>
    <p>Your ELVA Support password was updated by an administrator.</p>
    <p><strong>Sign in here:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>Email:</strong> ${escapeHtml(user.email)}<br/>
    <strong>New password:</strong> ${escapeHtml(plainPassword)}</p>
    <p>If you did not expect this change, contact your administrator immediately.</p>
    <p>— ELVA Support</p>
  `;

  return sendEmail({
    to: user.email,
    subject: "Your ELVA Support password was updated",
    html
  });
};

const sendMerchantWelcomeEmail = async (merchant, application) => {
  const loginUrl = `${getFrontendUrl()}/merchant/login`;
  const appName = application?.name || merchant.applicationCode || "your application";
  const supportEmail = env.email.supportAddress;

  const html = `
    <p>Dear ${escapeHtml(merchant.merchantName)},</p>
    <p>Welcome to <strong>ELVA Support</strong>. You now have access to our customer support portal for <strong>${escapeHtml(appName)}</strong>.</p>
    <p>Our customers are at the heart of everything we do — we are always ready to support you.</p>
    <p>To raise any query about <strong>${escapeHtml(appName)}</strong>, sign in with your registered email. We will send a one-time OTP to verify it is you.</p>
    <p><strong>Portal:</strong> <a href="${loginUrl}">${loginUrl}</a><br/>
    <strong>Your email:</strong> ${escapeHtml(merchant.email)}<br/>
    <strong>Support:</strong> <a href="mailto:${supportEmail}">${escapeHtml(supportEmail)}</a></p>
    <p>We look forward to helping you.</p>
    <p>— ELVA Support Team</p>
  `;

  return sendEmail({
    to: merchant.email,
    subject: `Welcome to ELVA Support for ${appName}`,
    html
  });
};

module.exports = {
  sendStaffWelcomeEmail,
  sendStaffPasswordUpdatedEmail,
  sendMerchantWelcomeEmail
};
