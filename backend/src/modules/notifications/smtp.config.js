const env = require("../../config/env");

const getSmtpConfig = () => env.email.smtp;

const isSmtpConfigured = () => {
  const cfg = getSmtpConfig();
  return Boolean(cfg.host && cfg.user && cfg.password);
};

module.exports = {
  getSmtpConfig,
  isSmtpConfigured
};
