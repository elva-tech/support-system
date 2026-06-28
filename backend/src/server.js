require("dotenv").config();

const dns = require("dns");

// Render and other cloud hosts often lack working IPv6 routes to Gmail (ENETUNREACH).
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const { validateEnvironment } = require("./config/validate-env");
const app = require("./app");
const env = require("./config/env");
const logger = require("./shared/utils/logger");
const { connectDatabase } = require("./config/database");
const { ensureAdminAccount } = require("./bootstrap/ensure-admin");
const notificationWorker = require("./modules/notifications/notification-worker.service");
const emailWorker = require("./modules/email/email-worker.service");
const emailInboundService = require("./modules/email/email-inbound.service");
const emailInboundWebhookService = require("./modules/email/email-inbound-webhook.service");
const { isSmtpConfigured } = require("./modules/notifications/smtp.config");

const start = async () => {
  try {
    validateEnvironment();
    await connectDatabase();
    await ensureAdminAccount();

    notificationWorker.start();
    emailWorker.start();

    if (!env.email.inboundEnabled) {
      logger.warn(
        "Email reply sync is OFF — set EMAIL_INBOUND_ENABLED=true for support@ replies to appear on tickets"
      );
    } else if (env.email.inboundProvider === "webhook") {
      if (emailInboundWebhookService.isConfigured()) {
        logger.info("Email inbound via Cloudflare webhook — POST /api/webhooks/inbound-email");
      } else {
        logger.warn(
          "EMAIL_INBOUND_PROVIDER=webhook but EMAIL_INBOUND_WEBHOOK_SECRET is missing — inbound email will be rejected"
        );
      }
    } else if (!emailInboundService.isConfigured()) {
      logger.warn(
        "Email IMAP inbound enabled but not configured — set EMAIL_IMAP_HOST, EMAIL_IMAP_USER, EMAIL_IMAP_PASSWORD"
      );
    }

    if (!isSmtpConfigured()) {
      logger.warn(
        "Outbound email is not configured — set SMTP_HOST, SMTP_USER, and SMTP_PASS for support@elvatech.in delivery"
      );
    }

    if (env.isProduction && env.notifications.provider === "SMTP" && isSmtpConfigured()) {
      logger.warn(
        "Render free tier blocks outbound SMTP (ports 587/465). Use NOTIFICATION_PROVIDER=RESEND with RESEND_API_KEY, or upgrade to a paid Render plan."
      );
    }

    const server = app.listen(env.port, () => {
      logger.info("ELVA Support API started", {
        port: env.port,
        nodeEnv: env.nodeEnv,
        storage: env.googleDrive.useMock ? "mock" : "google_drive",
        notificationProvider: env.notifications.provider,
        notificationFallback: env.notifications.fallbackEnabled
      });
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        logger.error(`Port ${env.port} is already in use. Stop the other process or run: npm run dev`);
        process.exit(1);
      }

      logger.error("Failed to start server", { error: error.message });
      process.exit(1);
    });
  } catch (error) {
    logger.error("Failed to start server", { error: error.message });
    process.exit(1);
  }
};

start();
