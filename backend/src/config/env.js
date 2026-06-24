require("dotenv").config();
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";

const parseFileSize = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: parseInt(process.env.PORT, 10) || 3000,
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/elva-support",
  jwtSecret: process.env.JWT_SECRET || "dev-only-jwt-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  otpLockMinutes: parseInt(process.env.OTP_LOCK_MINUTES, 10) || 15,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:4200",
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
    provider: process.env.NOTIFICATION_PROVIDER || "ELVA_NOTIFY",
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
      otpMode: process.env.ELVA_NOTIFY_OTP_MODE || "native",
      timeoutMs: parseInt(process.env.ELVA_NOTIFY_TIMEOUT_MS, 10) || 10000
    }
  }
};
