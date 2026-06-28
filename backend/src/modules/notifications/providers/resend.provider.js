const env = require("../../../config/env");
const NotificationProvider = require("./notification-provider.base");
const { NOTIFICATION_PROVIDERS } = require("../../../shared/constants/notification-types");
const { isResendConfigured } = require("../resend.config");
const { renderOtpEmail, renderNotificationEmail } = require("../email-templates");
const logger = require("../../../shared/utils/logger");

const RESEND_API_URL = "https://api.resend.com/emails";

const formatFrom = (address) => {
  const fromAddress = address || env.email.supportAddress;
  const fromName = env.email.resend.fromName || env.email.smtp.fromName;
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
};

class ResendProvider extends NotificationProvider {
  get name() {
    return NOTIFICATION_PROVIDERS.RESEND;
  }

  async sendOtp(payload) {
    if (!isResendConfigured()) {
      return { success: false, error: "Resend is not configured (RESEND_API_KEY)" };
    }

    if (!payload.otp) {
      return { success: false, error: "OTP code is required for email delivery" };
    }

    return this.sendEmail({
      to: payload.email,
      subject: "Your ELVA Support verification code",
      html: renderOtpEmail({
        otp: payload.otp,
        expiresInMinutes: payload.expiresInMinutes
      })
    });
  }

  async sendNotification(payload) {
    if (!isResendConfigured()) {
      return { success: false, error: "Resend is not configured (RESEND_API_KEY)" };
    }

    const html =
      payload.html ||
      renderNotificationEmail({
        subject: payload.subject,
        body: payload.body,
        merchantName: payload.metadata?.merchantName
      });

    return this.sendEmail({
      to: payload.recipientEmail,
      subject: payload.subject,
      html,
      headers: payload.headers,
      replyTo: payload.replyTo,
      from: payload.from
    });
  }

  async sendEmail(payload) {
    if (!isResendConfigured()) {
      return { success: false, error: "Resend is not configured (RESEND_API_KEY)" };
    }

    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    const fromAddress = payload.from || env.email.supportAddress;
    const timeoutMs = env.email.resend.timeoutMs;

    const body = {
      from: formatFrom(fromAddress),
      to: recipients,
      subject: payload.subject,
      html: payload.html,
      reply_to: payload.replyTo || env.email.supportAddress
    };

    if (payload.headers && Object.keys(payload.headers).length) {
      body.headers = payload.headers;
    }

    if (payload.text) {
      body.text = payload.text;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.email.resend.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = data.message || data.error || `Resend API error (${response.status})`;
        logger.warn("[ResendProvider] Email delivery failed", {
          to: recipients,
          subject: payload.subject,
          status: response.status,
          error
        });
        return { success: false, error };
      }

      return {
        success: true,
        messageId: data.id || null
      };
    } catch (error) {
      const message =
        error.name === "AbortError" ? `Resend request timed out after ${timeoutMs}ms` : error.message;
      logger.warn("[ResendProvider] Email delivery failed", {
        to: recipients,
        subject: payload.subject,
        error: message
      });
      return { success: false, error: message };
    }
  }
}

module.exports = ResendProvider;
