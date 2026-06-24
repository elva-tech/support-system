const logger = require("../shared/utils/logger");

const DEV_DEFAULTS = {
  MONGODB_URI: "mongodb://localhost:27017/elva-support",
  JWT_SECRET: "dev-only-jwt-secret-change-me",
  INTERNAL_API_KEY: "dev-internal-api-key-change-me"
};

const validateEnvironment = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const errors = [];

  const requiredInProduction = ["MONGODB_URI", "JWT_SECRET", "INTERNAL_API_KEY", "CORS_ORIGIN"];

  if (isProduction) {
    for (const key of requiredInProduction) {
      if (!process.env[key]) {
        errors.push(`${key} is required in production`);
      }
    }

    if (process.env.JWT_SECRET === DEV_DEFAULTS.JWT_SECRET) {
      errors.push("JWT_SECRET must not use the development default in production");
    }

    if (process.env.INTERNAL_API_KEY === DEV_DEFAULTS.INTERNAL_API_KEY) {
      errors.push("INTERNAL_API_KEY must not use the development default in production");
    }

    if (process.env.EXPOSE_OTP_IN_RESPONSE === "true") {
      errors.push("EXPOSE_OTP_IN_RESPONSE must be false in production");
    }

    if (process.env.NOTIFICATION_PROVIDER === "ELVA_NOTIFY") {
      const notifyKeys = ["ELVA_NOTIFY_API_URL", "ELVA_NOTIFY_APP_ID", "ELVA_NOTIFY_API_KEY"];
      for (const key of notifyKeys) {
        if (!process.env[key]) {
          errors.push(`${key} is required when NOTIFICATION_PROVIDER=ELVA_NOTIFY in production`);
        }
      }

      if (
        (process.env.ELVA_NOTIFY_OTP_MODE || "native") === "native" &&
        !process.env.ELVA_NOTIFY_BRAND_ID
      ) {
        errors.push("ELVA_NOTIFY_BRAND_ID is required for native OTP mode in production");
      }
    }
  } else {
    for (const [key, defaultValue] of Object.entries(DEV_DEFAULTS)) {
      if (!process.env[key]) {
        logger.warn(`Using development default for ${key}`);
      } else if (process.env[key] === defaultValue) {
        logger.warn(`${key} is set to the development default`);
      }
    }
  }

  if (errors.length) {
    logger.error("Environment validation failed", { errors });
    throw new Error(`Environment validation failed:\n- ${errors.join("\n- ")}`);
  }

  logger.info("Environment validation passed", { nodeEnv: process.env.NODE_ENV || "development" });
};

module.exports = { validateEnvironment };
