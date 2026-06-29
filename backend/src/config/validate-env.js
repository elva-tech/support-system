const logger = require("../shared/utils/logger");
const { isSmtpConfigured } = require("../modules/notifications/smtp.config");
const { isResendConfigured } = require("../modules/notifications/resend.config");

const DEV_DEFAULTS = {
  MONGODB_URI: "mongodb://localhost:27017/elva-support",
  JWT_SECRET: "dev-only-jwt-secret-change-me",
  INTERNAL_API_KEY: "dev-internal-api-key-change-me"
};

const validateEnvironment = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const errors = [];

  const requiredInProduction = ["MONGODB_URI", "JWT_SECRET", "INTERNAL_API_KEY", "CORS_ORIGIN"];

  if (isProduction) {
    for (const key of requiredInProduction) {
      if (!process.env[key]) {
        errors.push(`${key} is required in production`);
      }
    }

    if (process.env.JWT_SECRET === DEV_DEFAULTS.JWT_SECRET) {
      errors.push(
        "JWT_SECRET must not use the development default in production — set a long random string in Render Environment (not the value from .env.example)"
      );
    }

    if (process.env.INTERNAL_API_KEY === DEV_DEFAULTS.INTERNAL_API_KEY) {
      errors.push(
        "INTERNAL_API_KEY must not use the development default in production — set a long random string in Render Environment (not the value from .env.example)"
      );
    }

    if (process.env.EXPOSE_OTP_IN_RESPONSE === "true") {
      errors.push("EXPOSE_OTP_IN_RESPONSE must be false in production");
    }

    if (process.env.LOG_VIEWER_ENABLED === "false" && process.env.LOG_VIEWER_REQUIRE_AUTH === "false") {
      logger.warn("Log viewer disabled in production — set LOG_VIEWER_ENABLED=true to view logs at /");
    }

    if (process.env.NOTIFICATION_FALLBACK_ENABLED === "true") {
      errors.push(
        "NOTIFICATION_FALLBACK_ENABLED must be false in production — fallback only logs OTP/email and does not send real mail"
      );
    }

    if (!process.env.FRONTEND_URL && !process.env.CORS_ORIGIN) {
      errors.push("FRONTEND_URL or CORS_ORIGIN is required in production (for email links)");
    }

    if (process.env.EMAIL_INBOUND_ENABLED === "true") {
      const inboundProvider = (process.env.EMAIL_INBOUND_PROVIDER || "imap").toLowerCase();

      if (inboundProvider === "webhook") {
        if (!process.env.EMAIL_INBOUND_WEBHOOK_SECRET) {
          errors.push(
            "EMAIL_INBOUND_WEBHOOK_SECRET is required when EMAIL_INBOUND_PROVIDER=webhook in production"
          );
        }
      } else if (inboundProvider === "imap") {
        const imapKeys = ["EMAIL_IMAP_HOST", "EMAIL_IMAP_USER", "EMAIL_IMAP_PASSWORD"];
        for (const key of imapKeys) {
          if (!process.env[key]) {
            errors.push(`${key} is required when EMAIL_INBOUND_PROVIDER=imap in production`);
          }
        }
      } else {
        errors.push("EMAIL_INBOUND_PROVIDER must be imap or webhook");
      }
    }

    if (process.env.NOTIFICATION_PROVIDER === "ELVA_NOTIFY") {
      const notifyKeys = ["ELVA_NOTIFY_API_URL", "ELVA_NOTIFY_APP_ID", "ELVA_NOTIFY_API_KEY"];
      for (const key of notifyKeys) {
        if (!process.env[key]) {
          errors.push(`${key} is required when NOTIFICATION_PROVIDER=ELVA_NOTIFY in production`);
        }
      }

      if (
        (process.env.ELVA_NOTIFY_OTP_MODE || "relay") === "native" &&
        !process.env.ELVA_NOTIFY_BRAND_ID
      ) {
        errors.push("ELVA_NOTIFY_BRAND_ID is required for native OTP mode in production");
      }
    } else if (process.env.NOTIFICATION_PROVIDER === "RESEND" || isResendConfigured()) {
      if (!isResendConfigured()) {
        errors.push("RESEND_API_KEY is required when using Resend for outbound email");
      }
    } else if (!isSmtpConfigured()) {
      errors.push(
        "SMTP email is not configured in production — set SMTP_HOST, SMTP_USER, and SMTP_PASS (or use NOTIFICATION_PROVIDER=RESEND with RESEND_API_KEY on Render free tier)"
      );
    }
  } else {
    for (const [key, defaultValue] of Object.entries(DEV_DEFAULTS)) {
      if (!process.env[key]) {
        logger.warn(`Using development default for ${key}`);
      } else if (process.env[key] === defaultValue) {
        logger.warn(`${key} is set to the development default`);
      }
    }
  }

  if (errors.length) {
    logger.error("Environment validation failed", { errors });
    throw new Error(`Environment validation failed:\n- ${errors.join("\n- ")}`);
  }

  logger.info("Environment validation passed", { nodeEnv: process.env.NODE_ENV || "development" });
};

module.exports = { validateEnvironment };
