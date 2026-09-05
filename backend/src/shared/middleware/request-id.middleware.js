const crypto = require("crypto");

/**
 * Request correlation ID middleware (Phase 14).
 * Accepts a safe client-provided X-Request-ID or generates one.
 */

const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

const generateRequestId = () => crypto.randomBytes(16).toString("hex");

const normalizeIncomingRequestId = (raw) => {
  if (!raw) {
    return null;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = String(value || "").trim();
  if (!SAFE_REQUEST_ID.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const requestIdMiddleware = (req, res, next) => {
  const incoming = normalizeIncomingRequestId(req.headers[REQUEST_ID_HEADER]);
  req.requestId = incoming || generateRequestId();
  res.setHeader("X-Request-ID", req.requestId);
  next();
};

module.exports = {
  requestIdMiddleware,
  generateRequestId,
  normalizeIncomingRequestId,
  REQUEST_ID_HEADER,
  SAFE_REQUEST_ID
};
