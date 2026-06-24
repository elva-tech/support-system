process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-for-integration-tests";
process.env.INTERNAL_API_KEY = "test-internal-api-key";
process.env.NOTIFICATION_WORKER_ENABLED = "false";
process.env.GOOGLE_DRIVE_MOCK = "true";
process.env.NOTIFICATION_FALLBACK_ENABLED = "true";
process.env.EXPOSE_OTP_IN_RESPONSE = "true";
process.env.RATE_LIMIT_OTP_MAX = "100";
process.env.RATE_LIMIT_LOGIN_MAX = "100";

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongoServer;

const clearConfigCache = () => {
  const paths = [
    require.resolve("../src/config/env"),
    require.resolve("../src/config/database")
  ];
  paths.forEach((modulePath) => {
    delete require.cache[modulePath];
  });
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  clearConfigCache();

  const { connectDatabase } = require("../src/config/database");
  await connectDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
});
