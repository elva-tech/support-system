const mongoose = require("mongoose");
const env = require("../../config/env");
const packageJson = require("../../../package.json");

const getStorageStatus = () => {
  if (env.googleDrive.useMock) {
    return "mock";
  }

  if (env.googleDrive.serviceAccount && env.googleDrive.parentFolderId) {
    return "google_drive";
  }

  return "unavailable";
};

const getHealth = async () => {
  const mongodbState = mongoose.connection.readyState;
  const mongodb =
    mongodbState === 1 ? "connected" : mongodbState === 2 ? "connecting" : "disconnected";

  const storage = getStorageStatus();
  const status = mongodb === "connected" && storage !== "unavailable" ? "ok" : "degraded";

  return {
    status,
    mongodb,
    storage,
    version: packageJson.version
  };
};

module.exports = { getHealth };
