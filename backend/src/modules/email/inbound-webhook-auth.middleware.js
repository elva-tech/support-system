const crypto = require("crypto");
const env = require("../../config/env");
const ApiError = require("../../shared/utils/ApiError");

const safeCompare = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
};

const verifyInboundWebhookSecret = (req, _res, next) => {
  if (!env.email.inboundWebhookSecret) {
    return next(new ApiError(503, "Inbound email webhook is not configured"));
  }

  const provided =
    req.headers["x-inbound-webhook-secret"] ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : null);

  if (!provided || !safeCompare(provided, env.email.inboundWebhookSecret)) {
    return next(new ApiError(401, "Unauthorized"));
  }

  return next();
};

module.exports = {
  verifyInboundWebhookSecret
};
