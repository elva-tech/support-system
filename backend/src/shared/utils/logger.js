/**
 * Structured application logger (Phase 14).
 * Development: readable lines. Production: JSON to stdout when LOG_FORMAT=json.
 */

const { redactObject } = require("./log-redaction.util");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const MAX_LOG_ENTRIES = 1000;
const entries = [];

const parseLevel = () => {
  const raw = String(process.env.LOG_LEVEL || "info").toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, raw) ? raw : "info";
};

const shouldLog = (level) => LEVELS[level] <= LEVELS[parseLevel()];

const useJsonFormat = () =>
  process.env.LOG_FORMAT === "json" ||
  (process.env.NODE_ENV === "production" && process.env.LOG_FORMAT !== "pretty");

const pushViewerEntry = (level, line) => {
  entries.push({ level, line, timestamp: new Date().toISOString() });
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.shift();
  }
};

const write = (level, message, meta) => {
  if (!shouldLog(level)) {
    return;
  }

  const safeMeta = meta ? redactObject(meta) : undefined;
  const timestamp = new Date().toISOString();

  if (useJsonFormat()) {
    const payload = {
      timestamp,
      level,
      message,
      ...(safeMeta || {})
    };
    const line = JSON.stringify(payload);
    pushViewerEntry(level, line);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
    return;
  }

  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  const line = safeMeta ? `${base} ${JSON.stringify(safeMeta)}` : base;
  pushViewerEntry(level, line);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug") {
    if (process.env.NODE_ENV !== "production" || process.env.LOG_VIEWER_ENABLED !== "false") {
      console.debug(line);
    }
  } else {
    console.log(line);
  }
};

/**
 * Build safe request-scoped log fields from Express req (when available).
 */
const buildRequestLogFields = (req = null) => {
  if (!req) {
    return {};
  }

  const fields = {
    requestId: req.requestId || undefined,
    method: req.method,
    path: req.originalUrl || req.path
  };

  if (req.tenant?._id) {
    fields.tenantId = String(req.tenant._id);
    fields.tenantSlug = req.tenant.slug || undefined;
  }

  if (req.user?._id) {
    fields.userId = String(req.user._id);
    fields.identityType = "TENANT_USER";
  } else if (req.platformAdmin?._id) {
    fields.platformAdminId = String(req.platformAdmin._id);
    fields.identityType = "PLATFORM_ADMIN";
  } else if (req.merchant?._id) {
    fields.merchantId = String(req.merchant._id);
    fields.identityType = "MERCHANT";
  }

  return fields;
};

const logger = {
  info(message, meta) {
    write("info", message, meta);
  },
  warn(message, meta) {
    write("warn", message, meta);
  },
  error(message, meta) {
    write("error", message, meta);
  },
  debug(message, meta) {
    write("debug", message, meta);
  },
  /**
   * Log with request context merged (non-mutating).
   */
  withRequest(req, level, message, meta = {}) {
    const merged = { ...buildRequestLogFields(req), ...meta };
    write(level, message, merged);
  },
  buildRequestLogFields,
  getEntries() {
    return [...entries];
  },
  clear() {
    entries.length = 0;
  }
};

module.exports = logger;
