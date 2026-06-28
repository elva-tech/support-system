if (process.env.NODE_ENV !== "test") {
  require("dotenv").config();
}
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const parseFileSize = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseCorsOrigins = (value) => {
  if (!value) {
    return ["http://localhost:4200"];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: parseInt(process.env.PORT, 10) || 3000,
  mongodbUri: isTest
    ? process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/elva-support-test"
    : process.env.MONGODB_URI || "mongodb://localhost:27017/elva-support-dev",
  jwtSecret: process.env.JWT_SECRET || "dev-only-jwt-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  otpLockMinutes: parseInt(process.env.OTP_LOCK_MINUTES, 10) || 15,
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  corsAllowVercelPreviews: process.env.CORS_ALLOW_VERCEL_PREVIEWS === "true",
  frontendUrl:
    process.env.FRONTEND_URL ||
    parseCorsOrigins(process.env.CORS_ORIGIN)[0] ||
    "http://localhost:4200",
  logViewerEnabled:
    process.env.LOG_VIEWER_ENABLED === "true" ||
    (process.env.LOG_VIEWER_ENABLED !== "false" && !isProduction),
  internalApiKey: process.env.INTERNAL_API_KEY || "dev-internal-api-key-change-me",
  otpExpiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 10,
  merchantSessionExpiresMs:
    parseInt(process.env.MERCHANT_SESSION_EXPIRES_HOURS, 10) * 60 * 60 * 1000 || 24 * 60 * 60 * 1000,
  logOtpToConsole: process.env.LOG_OTP_TO_CONSOLE !== "false",
  exposeOtpInResponse: process.env.EXPOSE_OTP_IN_RESPONSE === "true",
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3000",
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, "../../uploads"),
  uploadMaxFileSize: parseFileSize(process.env.UPLOAD_MAX_FILE_SIZE, 10 * 1024 * 1024),
  rateLimit: {
    loginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 10,
    otpMax: parseInt(process.env.RATE_LIMIT_OTP_MAX, 10) || 5,
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000
  },
  googleDrive: {
    useMock: process.env.GOOGLE_DRIVE_MOCK !== "false",
    parentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "",
    serviceAccount: (() => {
      const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        try {
          return JSON.parse(require("fs").readFileSync(raw, "utf8"));
        } catch {
          return null;
        }
      }
    })()
  },
  admin: {
    email: process.env.ADMIN_EMAIL || "admin@elva.com",
    password: process.env.ADMIN_PASSWORD || "Admin@123",
    firstName: process.env.ADMIN_FIRST_NAME || "System",
    lastName: process.env.ADMIN_LAST_NAME || "Administrator"
  },
  notifications: {
    provider: process.env.NOTIFICATION_PROVIDER || "SMTP",
    fallbackEnabled: process.env.NOTIFICATION_FALLBACK_ENABLED !== "false",
    worker: {
      enabled: process.env.NOTIFICATION_WORKER_ENABLED !== "false",
      pollIntervalMs: parseInt(process.env.NOTIFICATION_WORKER_POLL_MS, 10) || 5000,
      batchSize: parseInt(process.env.NOTIFICATION_WORKER_BATCH_SIZE, 10) || 10
    },
    elvaNotify: {
      apiUrl: process.env.ELVA_NOTIFY_API_URL || "https://api.notify.elvatech.in",
      apiKey: process.env.ELVA_NOTIFY_API_KEY || "",
      appId: process.env.ELVA_NOTIFY_APP_ID || "",
      brandId: process.env.ELVA_NOTIFY_BRAND_ID || "",
      otpMode: process.env.ELVA_NOTIFY_OTP_MODE || "relay",
      timeoutMs: parseInt(process.env.ELVA_NOTIFY_TIMEOUT_MS, 10) || 10000
    }
  },
  email: {
    supportAddress: process.env.EMAIL_SUPPORT_ADDRESS || "support@elvatech.in",
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure:
        process.env.SMTP_SECURE === "true" ||
        (parseInt(process.env.SMTP_PORT, 10) || 587) === 465,
      user: process.env.SMTP_USER || process.env.EMAIL_IMAP_USER || "",
      password: process.env.SMTP_PASS || process.env.EMAIL_IMAP_PASSWORD || "",
      fromName: process.env.SMTP_FROM_NAME || "ELVA Support",
      connectionTimeoutMs: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10) || 20000,
      greetingTimeoutMs: parseInt(process.env.SMTP_GREETING_TIMEOUT_MS, 10) || 20000,
      socketTimeoutMs: parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS, 10) || 30000,
      family: parseInt(process.env.SMTP_FAMILY, 10) || 4
    },
    inboundEnabled: process.env.EMAIL_INBOUND_ENABLED === "true",
    imap: {
      host: process.env.EMAIL_IMAP_HOST || "",
      port: parseInt(process.env.EMAIL_IMAP_PORT, 10) || 993,
      secure: process.env.EMAIL_IMAP_SECURE !== "false",
      user: process.env.EMAIL_IMAP_USER || "",
      password: process.env.EMAIL_IMAP_PASSWORD || "",
      pollIntervalMs: parseInt(process.env.EMAIL_IMAP_POLL_MS, 10) || 60000,
      pollTimeoutMs: parseInt(process.env.EMAIL_IMAP_POLL_TIMEOUT_MS, 10) || 120000,
      batchSize: parseInt(process.env.EMAIL_IMAP_BATCH_SIZE, 10) || 25,
      lookbackDays: parseInt(process.env.EMAIL_IMAP_LOOKBACK_DAYS, 10) || 3,
      mailbox: process.env.EMAIL_IMAP_MAILBOX || process.env.EMAIL_SUPPORT_ADDRESS || ""
    }
  }
};
