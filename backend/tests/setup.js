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
process.env.TENANT_DEV_DEFAULT_SLUG = "elva";
process.env.TENANT_HEADER_OVERRIDE_ENABLED = "true";
process.env.TENANT_BASE_DOMAIN = "elvasupport.in";

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

const syncCriticalIndexes = async () => {
  await Promise.all([
    require("../src/modules/applications/application.model").syncIndexes(),
    require("../src/modules/tickets/ticket-sequence.model").syncIndexes(),
    require("../src/modules/merchants/merchant-profile.model").syncIndexes(),
    require("../src/modules/tenants/tenant.model").syncIndexes(),
    require("../src/modules/users/user.model").syncIndexes()
  ]);
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
  await syncCriticalIndexes();
});

beforeEach(async () => {
  await safeDropDatabase();
  await syncCriticalIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  await safeDropDatabase();
});
