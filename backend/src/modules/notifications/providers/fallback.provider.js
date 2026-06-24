const logger = require("../../../shared/utils/logger");
const NotificationProvider = require("./notification-provider.base");
const { NOTIFICATION_PROVIDERS } = require("../../../shared/constants/notification-types");

/**
 * Development and disaster-recovery fallback.
 * Logs OTP and notification payloads instead of sending via SMTP/SMS.
 * Replace or extend with SMTP, Fast2SMS, MSG91, or Gupshup in future phases.
 */
class FallbackProvider extends NotificationProvider {
  get name() {
    return NOTIFICATION_PROVIDERS.FALLBACK;
  }

  async sendOtp(payload) {
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
}

module.exports = FallbackProvider;
