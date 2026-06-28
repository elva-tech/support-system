require("dotenv").config();

const { validateEnvironment } = require("./config/validate-env");
const app = require("./app");
const env = require("./config/env");
const logger = require("./shared/utils/logger");
const { connectDatabase } = require("./config/database");
const { ensureAdminAccount } = require("./bootstrap/ensure-admin");
const notificationWorker = require("./modules/notifications/notification-worker.service");
const emailWorker = require("./modules/email/email-worker.service");
const emailInboundService = require("./modules/email/email-inbound.service");
const { isSmtpConfigured } = require("./modules/notifications/smtp.config");

const start = async () => {
  try {
    validateEnvironment();
    await connectDatabase();
    await ensureAdminAccount();

    notificationWorker.start();
    emailWorker.start();

    if (!env.email.inboundEnabled || !emailInboundService.isConfigured()) {
      logger.warn(
        "Email reply sync is OFF — set EMAIL_INBOUND_ENABLED=true and EMAIL_IMAP_* for support@ replies to appear on tickets"
      );
    }

    if (!isSmtpConfigured()) {
      logger.warn(
        "Outbound email is not configured — set SMTP_HOST, SMTP_USER, and SMTP_PASS for support@elvatech.in delivery"
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
