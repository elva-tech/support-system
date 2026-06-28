const env = require("../../config/env");

const isResendConfigured = () => Boolean(env.email.resend.apiKey);

module.exports = {
  isResendConfigured,
  getResendConfig: () => env.email.resend
};
