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

  if (env.email.inboundProvider !== "imap") {
    logger.info("Email IMAP worker skipped — inbound uses Cloudflare webhook", {
      provider: env.email.inboundProvider
    });
    return;
  }

  if (!emailInboundService.isConfigured()) {
    logger.warn("Email inbound enabled but IMAP is not fully configured");
    return;
  }

  if (intervalHandle) {
    return;
  }

  const pollIntervalMs = env.email.imap.pollIntervalMs;
  const pollTimeoutMs = env.email.imap.pollTimeoutMs;

  if (pollIntervalMs <= pollTimeoutMs) {
    logger.warn(
      "EMAIL_IMAP_POLL_MS should be greater than EMAIL_IMAP_POLL_TIMEOUT_MS — overlapping polls cause IMAP errors",
      { pollIntervalMs, pollTimeoutMs }
    );
  }

  logger.info("Email inbound worker started", {
    pollIntervalMs,
    pollTimeoutMs,
    mailbox: env.email.imap.mailbox || "INBOX"
  });

  const run = async () => {
    if (pollInProgress) {
      logger.info("Skipping email poll — previous poll still running");
      return;
    }

    pollInProgress = true;
    const timeoutMs = pollTimeoutMs;
    let timeoutHandle;
    let timedOut = false;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        reject(new Error(`IMAP poll timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      await Promise.race([emailInboundService.pollInbox(), timeoutPromise]);
    } catch (error) {
      if (timedOut) {
        await emailInboundService.forceCloseActiveClient();
      }
      logger.error("Email inbound poll failed", { error: error.message, code: error.code });
    } finally {
      clearTimeout(timeoutHandle);
      pollInProgress = false;
    }
  };

  run();
  intervalHandle = setInterval(run, pollIntervalMs);
};

const stop = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("Email inbound worker stopped");
  }
};

module.exports = { start, stop };
