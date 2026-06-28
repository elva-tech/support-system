const logger = require("../../../shared/utils/logger");
const NotificationProvider = require("./notification-provider.base");
const { NOTIFICATION_PROVIDERS } = require("../../../shared/constants/notification-types");

/**
 * Development and disaster-recovery fallback.
 * Logs OTP and email payloads instead of sending via SMTP/SMS.
 */
class FallbackProvider extends NotificationProvider {
  get name() {
    return NOTIFICATION_PROVIDERS.FALLBACK;
  }

  async sendOtp(payload) {
    if (!payload.otp) {
      logger.warn("[FallbackProvider] Cannot deliver OTP — no code available", {
        channel: payload.channel,
        email: payload.email
      });
      return {
        success: false,
        error: "Email delivery is unavailable. SMTP could not send the verification code."
      };
    }

    logger.info("[FallbackProvider] OTP delivery", {
      channel: payload.channel,
      email: payload.email,
      phone: payload.phone || null,
      otp: payload.otp,
      expiresInMinutes: payload.expiresInMinutes
    });

    return { success: true, messageId: `fallback-otp-${Date.now()}` };
  }

  async sendNotification(payload) {
    logger.info("[FallbackProvider] Notification delivery", {
      eventType: payload.eventType,
      recipientEmail: payload.recipientEmail,
      recipientPhone: payload.recipientPhone || null,
      subject: payload.subject,
      body: payload.body,
      metadata: payload.metadata || {}
    });

    return { success: true, messageId: `fallback-notification-${Date.now()}` };
  }

  async sendEmail(payload) {
    logger.info("[FallbackProvider] Email delivery", {
      to: payload.to,
      subject: payload.subject,
      from: payload.from || null,
      replyTo: payload.replyTo || null
    });

    return { success: true, messageId: `fallback-email-${Date.now()}` };
  }
}

module.exports = FallbackProvider;
