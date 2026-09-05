const rateLimit = require("express-rate-limit");
const env = require("../../config/env");
const ApiError = require("../utils/ApiError");
const { SECURITY_EVENTS, logSecurityEvent } = require("../observability/security-events");

/**
 * Focused rate limiting for abuse-sensitive endpoints (Phase 14).
 * In-memory store by default — suitable for single-instance; swap store later for Redis.
 */

const rateLimitHandler = (kind) => (req, _res, next) => {
  logSecurityEvent(SECURITY_EVENTS.AUTH_RATE_LIMITED, req, { kind });
  next(new ApiError(429, "Too many requests. Please try again later."));
};

const skipWhenDisabled = () => !env.rateLimit.enabled;

/** Prefer req.ip (honors trust proxy). Do not invent email existence via keys. */
const ipKeyGenerator = (req) => req.ip || req.socket?.remoteAddress || "unknown";

const loginLimiter = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipWhenDisabled,
  keyGenerator: ipKeyGenerator,
  handler: rateLimitHandler("auth_login")
});

const otpLimiter = rateLimit({
  windowMs: env.rateLimit.otpWindowMs,
  max: env.rateLimit.otpMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipWhenDisabled,
  keyGenerator: ipKeyGenerator,
  handler: rateLimitHandler("otp")
});

const onboardingLimiter = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipWhenDisabled,
  keyGenerator: ipKeyGenerator,
  handler: rateLimitHandler("onboarding")
});

module.exports = { loginLimiter, otpLimiter, onboardingLimiter };
