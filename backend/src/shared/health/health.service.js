const mongoose = require("mongoose");
const packageJson = require("../../../package.json");
const env = require("../../config/env");
const { getAppVersionMeta } = require("../observability/app-version");

const getStorageStatus = () => {
  if (env.googleDrive.useMock) {
    return "mock";
  }

  if (env.googleDrive.serviceAccount && env.googleDrive.parentFolderId) {
    return "google_drive";
  }

  return "unavailable";
};

/** Liveness — process is up; no dependency checks. Keep payload minimal for LB probes. */
const getLiveness = () => {
  const body = { status: "ok" };
  if (process.env.HEALTH_INCLUDE_VERSION === "true") {
    Object.assign(body, getAppVersionMeta());
    body.environment = env.nodeEnv;
  }
  return body;
};

/** Readiness — MongoDB must be connected. */
const getReadiness = async () => {
  const mongodbState = mongoose.connection.readyState;
  const mongodbConnected = mongodbState === 1;

  if (!mongodbConnected) {
    return {
      status: "not_ready",
      reason: "database_unavailable"
    };
  }

  return {
    status: "ready"
  };
};

/**
 * Detailed health (ops / legacy). Prefer /health and /health/ready in production probes.
 */
const getHealth = async () => {
  const mongodbState = mongoose.connection.readyState;
  const mongodb =
    mongodbState === 1 ? "connected" : mongodbState === 2 ? "connecting" : "disconnected";

  const storage = getStorageStatus();
  const status = mongodb === "connected" && storage !== "unavailable" ? "ok" : "degraded";
  const versionMeta = getAppVersionMeta();

  return {
    status,
    mongodb,
    storage,
    version: versionMeta.version || packageJson.version,
    ...versionMeta,
    environment: env.nodeEnv
  };
};

module.exports = { getHealth, getLiveness, getReadiness };
