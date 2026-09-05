/**
 * Recursive redaction for structured logs (Phase 14).
 * Reuses audit-sensitive patterns and extends for OTP / cookies / headers.
 */

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|jwt|apikey|api[_-]?key|authorization|credential|hash|rawtoken|invitationtoken|cookie|otp|clientsecret|access[_-]?token|refresh[_-]?token)/i;

const REDACTED = "[REDACTED]";

const redactValue = (value, depth = 0) => {
  if (depth > 8) {
    return "[TRUNCATED]";
  }
  if (value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(process.env.NODE_ENV !== "production" && value.stack ? { stack: value.stack } : {})
    };
  }
  if (typeof value === "object") {
    return redactObject(value, depth + 1);
  }
  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}…[truncated]`;
  }
  return value;
};

const redactObject = (input = {}, depth = 0) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactValue(value, depth);
  }
  return out;
};

module.exports = {
  SENSITIVE_KEY_PATTERN,
  REDACTED,
  redactObject,
  redactValue
};
