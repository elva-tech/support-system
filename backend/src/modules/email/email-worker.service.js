const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const emailInboundService = require("./email-inbound.service");

let intervalHandle = null;
let pollInProgress = false;

const start = () => {
  if (!env.email.inboundEnabled) {
    logger.info("Email inbound worker is disabled");
    return;
  }

  if (!emailInboundService.isConfigured()) {
    logger.warn("Email inbound enabled but IMAP is not fully configured");
    return;
  }

  if (intervalHandle) {
    return;
  }

  logger.info("Email inbound worker started", {
    pollIntervalMs: env.email.imap.pollIntervalMs,
    pollTimeoutMs: env.email.imap.pollTimeoutMs,
    mailbox: env.email.imap.mailbox || "INBOX"
  });

  const run = async () => {
    if (pollInProgress) {
      logger.info("Skipping email poll — previous poll still running");
      return;
    }

    pollInProgress = true;
    const timeoutMs = env.email.imap.pollTimeoutMs;
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`IMAP poll timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });

    try {
      await Promise.race([emailInboundService.pollInbox(), timeoutPromise]);
    } catch (error) {
      logger.error("Email inbound poll failed", { error: error.message, code: error.code });
    } finally {
      clearTimeout(timeoutHandle);
      pollInProgress = false;
    }
  };

  run();
  intervalHandle = setInterval(run, env.email.imap.pollIntervalMs);
};

const stop = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("Email inbound worker stopped");
  }
};

module.exports = { start, stop };
