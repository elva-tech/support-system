const logger = require("../utils/logger");
const { TENANT_ERROR_CODES } = require("../constants/tenant");
const { PROVISIONING_ERROR_CODES } = require("../constants/provisioning");
const { SECURITY_EVENTS, logSecurityEvent } = require("../observability/security-events");

const extractErrorCode = (err) => {
  if (err?.errors?.code) {
    return err.errors.code;
  }
  if (err?.code && typeof err.code === "string") {
    return err.code;
  }
  return null;
};

const maybeLogSecurityFromError = (err, req) => {
  const code = extractErrorCode(err);

  if (code === TENANT_ERROR_CODES.TENANT_ACCESS_DENIED) {
    logSecurityEvent(SECURITY_EVENTS.CROSS_TENANT_ACCESS_BLOCKED, req, {
      errorCode: code
    });
    return;
  }
  if (code === TENANT_ERROR_CODES.TENANT_OVERRIDE_FORBIDDEN) {
    logSecurityEvent(SECURITY_EVENTS.TENANT_HEADER_OVERRIDE_ATTEMPT, req, {
      errorCode: code
    });
    return;
  }
  if (code === TENANT_ERROR_CODES.INVALID_TENANT_HOST) {
    logSecurityEvent(SECURITY_EVENTS.INVALID_TENANT_HOST, req, {
      errorCode: code
    });
    return;
  }
  if (
    code === PROVISIONING_ERROR_CODES.INVALID_INVITATION ||
    code === PROVISIONING_ERROR_CODES.INVITATION_ALREADY_USED
  ) {
    logSecurityEvent(SECURITY_EVENTS.INVITATION_TOKEN_INVALID, req, {
      errorCode: code
    });
    return;
  }
  if (code === PROVISIONING_ERROR_CODES.INVITATION_EXPIRED) {
    logSecurityEvent(SECURITY_EVENTS.INVITATION_TOKEN_EXPIRED, req, {
      errorCode: code
    });
  }
};

const errorHandler = (err, req, res, _next) => {
  const requestId = req.requestId || res.getHeader("X-Request-ID") || undefined;

  if (err.name === "CastError") {
    return res.status(400).json({
      message: "Invalid resource identifier",
      requestId
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({
      message: `${field} already exists`,
      requestId
    });
  }

  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({
      message: "Validation failed",
      errors,
      requestId
    });
  }

  maybeLogSecurityFromError(err, req);

  const statusCode = err.statusCode || 500;
  const isOperational = Boolean(err.isOperational);

  if (!isOperational) {
    logger.withRequest(req, "error", "unhandled_error", {
      statusCode: 500,
      errorCode: "INTERNAL_ERROR",
      errorName: err.name,
      errorMessage: err.message,
      ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {})
    });

    return res.status(500).json({
      message: "An unexpected error occurred",
      requestId,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId
      }
    });
  }

  if (statusCode >= 500) {
    logger.withRequest(req, "error", "operational_server_error", {
      statusCode,
      errorCode: extractErrorCode(err),
      errorMessage: err.message
    });
  } else if (statusCode >= 400) {
    logger.withRequest(req, "warn", "client_error", {
      statusCode,
      errorCode: extractErrorCode(err),
      errorMessage: err.message
    });
  }

  const body = {
    message: err.message || "Request failed",
    requestId
  };

  if (err.errors) {
    body.errors = err.errors;
  }

  // Preserve code at top level when present (existing contract uses errors.code)
  const code = extractErrorCode(err);
  if (code && !body.errors) {
    body.errors = { code };
  }

  res.status(statusCode).json(body);
};

module.exports = errorHandler;
module.exports.extractErrorCode = extractErrorCode;
