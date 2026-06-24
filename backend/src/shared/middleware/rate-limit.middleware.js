const rateLimit = require("express-rate-limit");
const env = require("../../config/env");
const ApiError = require("../utils/ApiError");

const rateLimitHandler = (_req, _res, next) => {
  next(new ApiError(429, "Too many requests. Please try again later."));
};

const loginLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

const otpLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.otpMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

module.exports = { loginLimiter, otpLimiter };
