process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-for-integration-tests";
process.env.INTERNAL_API_KEY = "test-internal-api-key";
process.env.NOTIFICATION_WORKER_ENABLED = "false";
process.env.GOOGLE_DRIVE_MOCK = "true";
process.env.NOTIFICATION_FALLBACK_ENABLED = "true";
process.env.EXPOSE_OTP_IN_RESPONSE = "true";
process.env.ELVA_NOTIFY_APP_ID = "";
process.env.ELVA_NOTIFY_API_KEY = "";
process.env.ELVA_NOTIFY_BRAND_ID = "";
process.env.ELVA_NOTIFY_OTP_MODE = "relay";
process.env.RATE_LIMIT_OTP_MAX = "100";
process.env.RATE_LIMIT_LOGIN_MAX = "100";

const mongoose = require("mongoose");
const { assertSafeToDrop, isSafeTestUri } = require("../src/config/db-safety");

const testMongoUri = process.env.MONGODB_URI;

const safeDropDatabase = async () => {
  if (!mongoose.connection.db) {
    return;
  }

  assertSafeToDrop(testMongoUri);
  await mongoose.connection.db.dropDatabase();
};

beforeAll(async () => {
  if (!isSafeTestUri(testMongoUri)) {
    throw new Error(`Tests refused to start — MONGODB_URI is not isolated: ${testMongoUri}`);
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  const { connectDatabase } = require("../src/config/database");
  await connectDatabase();
});

beforeEach(async () => {
  await safeDropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  await safeDropDatabase();
});
