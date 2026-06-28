const SmtpProvider = require("./smtp.provider");
const ResendProvider = require("./resend.provider");
const ElvaNotifyProvider = require("./elva-notify.provider");
const FallbackProvider = require("./fallback.provider");

module.exports = {
  SmtpProvider,
  ResendProvider,
  ElvaNotifyProvider,
  FallbackProvider
};
