const nodemailer = require("nodemailer");
const env = require("../../../config/env");
const NotificationProvider = require("./notification-provider.base");
const { NOTIFICATION_PROVIDERS } = require("../../../shared/constants/notification-types");
const { getSmtpConfig, isSmtpConfigured } = require("../smtp.config");
const { renderOtpEmail, renderNotificationEmail } = require("../email-templates");
const logger = require("../../../shared/utils/logger");

let transport = null;

const getTransport = () => {
  if (transport) {
    return transport;
  }

  const cfg = getSmtpConfig();
  transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    family: cfg.family,
    auth: {
      user: cfg.user,
      pass: cfg.password
    },
    connectionTimeout: cfg.connectionTimeoutMs,
    greetingTimeout: cfg.greetingTimeoutMs,
    socketTimeout: cfg.socketTimeoutMs
  });

  return transport;
};

const formatFrom = (address) => {
  const fromAddress = address || env.email.supportAddress;
  const fromName = getSmtpConfig().fromName;
  return fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;
};

class SmtpProvider extends NotificationProvider {
  get name() {
    return NOTIFICATION_PROVIDERS.SMTP;
  }

  async sendOtp(payload) {
    if (!isSmtpConfigured()) {
      return { success: false, error: "SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)" };
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
    if (!isSmtpConfigured()) {
      return { success: false, error: "SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)" };
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
    if (!isSmtpConfigured()) {
      return { success: false, error: "SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)" };
    }

    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    const fromAddress = payload.from || env.email.supportAddress;

    try {
      const info = await getTransport().sendMail({
        from: formatFrom(fromAddress),
        to: recipients.join(", "),
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo || env.email.supportAddress,
        headers: payload.headers || {}
      });

      return {
        success: true,
        messageId: info.messageId || null
      };
    } catch (error) {
      logger.warn("[SmtpProvider] Email delivery failed", {
        to: recipients,
        subject: payload.subject,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = SmtpProvider;
