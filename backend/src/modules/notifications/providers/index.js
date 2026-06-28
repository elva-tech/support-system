const SmtpProvider = require("./smtp.provider");
const ElvaNotifyProvider = require("./elva-notify.provider");
const FallbackProvider = require("./fallback.provider");

module.exports = {
  SmtpProvider,
  ElvaNotifyProvider,
  FallbackProvider
};
