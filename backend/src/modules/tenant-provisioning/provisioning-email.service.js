const notificationManager = require("../notifications/notification-manager.service");
const logger = require("../../shared/utils/logger");
const env = require("../../config/env");
const { renderTenantAdminInvitationEmail } = require("../notifications/email-templates");
const { buildEmailBranding } = require("../../shared/utils/tenant-ops.util");

/**
 * Welcome / invitation email for provisioned tenant administrators.
 * Uses NotificationManager (Resend / SMTP / fallback) — does not throw on delivery failure.
 */
const sendTenantAdminInvitationEmail = async ({
  to,
  adminName,
  tenantName,
  workspaceUrl,
  invitationUrl,
  expiryHours,
  tenant = null
}) => {
  const branding = buildEmailBranding(tenant);
  const result = await notificationManager.sendEmail({
    to,
    subject: `Welcome to ELVA Support — activate your ${tenantName} workspace`,
    html: renderTenantAdminInvitationEmail({
      adminName,
      tenantName,
      workspaceUrl,
      invitationUrl,
      expiryHours: expiryHours || env.tenantProvisioning.invitationExpiryHours,
      supportEmail: env.email.supportAddress,
      branding
    })
  });

  if (!result.success) {
    logger.warn("Tenant admin invitation email delivery failed", {
      to,
      tenantName,
      error: result.error
    });
  }

  return result;
};

module.exports = {
  sendTenantAdminInvitationEmail
};
