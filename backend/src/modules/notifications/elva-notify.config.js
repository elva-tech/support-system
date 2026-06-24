const env = require("../../config/env");

const normalizeApiUrl = (url) => {
  if (!url) {
    return "";
  }
  return url.replace(/\/api\/?$/i, "").replace(/\/$/, "");
};

const getElvaNotifyConfig = () => {
  const cfg = env.notifications.elvaNotify;
  return {
    ...cfg,
    apiUrl: normalizeApiUrl(cfg.apiUrl)
  };
};

const isElvaNotifyConfigured = () => {
  const cfg = getElvaNotifyConfig();
  return Boolean(cfg.apiUrl && cfg.apiKey && cfg.appId);
};

const usesElvaNotifyNativeOtp = () => {
  const cfg = getElvaNotifyConfig();
  if (cfg.otpMode === "relay") {
    return false;
  }
  return isElvaNotifyConfigured() && Boolean(cfg.brandId);
};

module.exports = {
  getElvaNotifyConfig,
  isElvaNotifyConfigured,
  usesElvaNotifyNativeOtp
};
