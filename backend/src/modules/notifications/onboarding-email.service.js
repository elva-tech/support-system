const notificationManager = require("./notification-manager.service");
const Team = require("../teams/team.model");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const {
  renderStaffWelcomeEmail,
  renderStaffPasswordUpdatedEmail,
  renderMerchantWelcomeEmail
} = require("./email-templates");

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

  return sendEmail({
    to: user.email,
    subject: "Welcome to ELVA Support — your account is ready",
    html: renderStaffWelcomeEmail({
      firstName: user.firstName,
      applicationName,
      teamName,
      email: user.email,
      plainPassword
    })
  });
};

const sendStaffPasswordUpdatedEmail = async (user, plainPassword) =>
  sendEmail({
    to: user.email,
    subject: "Your ELVA Support password was updated",
    html: renderStaffPasswordUpdatedEmail({
      firstName: user.firstName,
      email: user.email,
      plainPassword
    })
  });

const sendMerchantWelcomeEmail = async (merchant, application) => {
  const appName = application?.name || merchant.applicationCode || "your application";

  return sendEmail({
    to: merchant.email,
    subject: `Welcome to ELVA Support for ${appName}`,
    html: renderMerchantWelcomeEmail({
      merchantName: merchant.merchantName,
      appName,
      email: merchant.email,
      supportEmail: env.email.supportAddress
    })
  });
};

module.exports = {
  sendStaffWelcomeEmail,
  sendStaffPasswordUpdatedEmail,
  sendMerchantWelcomeEmail
};
