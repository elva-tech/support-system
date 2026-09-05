/**
 * Application version / build metadata (Phase 14).
 * All values optional — never require Git at runtime.
 */

const packageJson = require("../../../package.json");

const getAppVersionMeta = () => {
  const version = process.env.APP_VERSION || packageJson.version || "unknown";
  const gitSha = process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || "";
  const buildTimestamp = process.env.BUILD_TIMESTAMP || "";

  const meta = { version };
  if (gitSha) {
    meta.gitSha = String(gitSha).slice(0, 40);
  }
  if (buildTimestamp) {
    meta.buildTimestamp = String(buildTimestamp);
  }
  return meta;
};

module.exports = { getAppVersionMeta };
