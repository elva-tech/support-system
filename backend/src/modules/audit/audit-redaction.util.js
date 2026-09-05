/**
 * Redact sensitive keys from audit metadata before API responses.
 */
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|jwt|apikey|api_key|authorization|credential|hash|rawtoken|invitationtoken)/i;

const redactValue = (value) => {
  if (value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (typeof value === "object") {
    return redactMetadata(value);
  }
  return value;
};

const redactMetadata = (metadata = {}) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = redactValue(value);
  }
  return out;
};

const toPublicAuditLog = (entry) => {
  if (!entry) {
    return null;
  }
  const doc = typeof entry.toObject === "function" ? entry.toObject() : { ...entry };
  return {
    ...doc,
    metadata: redactMetadata(doc.metadata || {})
  };
};

module.exports = {
  redactMetadata,
  toPublicAuditLog,
  SENSITIVE_KEY_PATTERN
};
