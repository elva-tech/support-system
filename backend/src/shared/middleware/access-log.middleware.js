const logger = require("../utils/logger");
const { recordHttpRequest } = require("../observability/metrics");

/**
 * Centralized access logging (Phase 14).
 * Skips or quiets health probes when configured.
 */

const isHealthPath = (path) =>
  path === "/health" ||
  path === "/health/ready" ||
  path === "/health/detail" ||
  path.startsWith("/health/");

const accessLogMiddleware = (req, res, next) => {
  const started = Date.now();

  res.on("finish", () => {
    const path = req.originalUrl || req.path || "";
    const durationMs = Date.now() - started;
    const statusCode = res.statusCode;

    recordHttpRequest({ method: req.method, statusCode, durationMs });

    const logHealth = process.env.LOG_HEALTH_REQUESTS === "true";
    const logRequests = process.env.LOG_REQUESTS !== "false";

    if (!logRequests) {
      return;
    }
    if (isHealthPath(path) && !logHealth) {
      return;
    }

    logger.withRequest(req, "info", "http_access", {
      statusCode,
      durationMs
    });
  });

  next();
};

module.exports = { accessLogMiddleware, isHealthPath };
