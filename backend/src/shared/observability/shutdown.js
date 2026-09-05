const mongoose = require("mongoose");
const logger = require("../utils/logger");

/**
 * Graceful shutdown helpers (Phase 14).
 */

let shuttingDown = false;

const isShuttingDown = () => shuttingDown;

/**
 * @param {import('http').Server} server
 * @param {{ timeoutMs?: number, workers?: Array<{ stop?: Function }> }} options
 */
const registerGracefulShutdown = (server, options = {}) => {
  const timeoutMs =
    options.timeoutMs ??
    (() => {
      const parsed = parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
    })();

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.warn("graceful_shutdown_started", { signal, timeoutMs });

    const forceTimer = setTimeout(() => {
      logger.error("graceful_shutdown_timeout", { timeoutMs });
      process.exit(1);
    }, timeoutMs);
    forceTimer.unref?.();

    try {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info("http_server_closed");

      for (const worker of options.workers || []) {
        try {
          if (typeof worker?.stop === "function") {
            worker.stop();
          }
        } catch (err) {
          logger.warn("worker_stop_failed", { error: err.message });
        }
      }

      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info("mongodb_connection_closed");
      }

      clearTimeout(forceTimer);
      logger.info("graceful_shutdown_complete", { signal });
      process.exit(0);
    } catch (err) {
      clearTimeout(forceTimer);
      logger.error("graceful_shutdown_failed", { error: err.message });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
};

/**
 * Production-safe unhandled error hooks.
 * Logs and exits — do not continue in a corrupted state.
 */
const registerProcessErrorHandlers = () => {
  process.on("uncaughtException", (err) => {
    logger.error("uncaught_exception", {
      error: err.message,
      name: err.name,
      ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {})
    });
    // Allow logger flush then exit
    setTimeout(() => process.exit(1), 250).unref?.();
  });

  process.on("unhandledRejection", (reason) => {
    const message =
      reason instanceof Error ? reason.message : String(reason || "unknown");
    logger.error("unhandled_rejection", {
      error: message,
      ...(reason instanceof Error && process.env.NODE_ENV !== "production"
        ? { stack: reason.stack }
        : {})
    });
    if (process.env.NODE_ENV === "production" || process.env.FATAL_ON_UNHANDLED_REJECTION === "true") {
      setTimeout(() => process.exit(1), 250).unref?.();
    }
  });
};

module.exports = {
  registerGracefulShutdown,
  registerProcessErrorHandlers,
  isShuttingDown
};
