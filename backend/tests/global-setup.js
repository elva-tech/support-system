const { MongoMemoryServer } = require("mongodb-memory-server");

module.exports = async () => {
  const mongoServer = await MongoMemoryServer.create();
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.TENANT_DEV_DEFAULT_SLUG = "elva";
  process.env.TENANT_HEADER_OVERRIDE_ENABLED = "true";
  process.env.TENANT_BASE_DOMAIN = "elvasupport.in";
  global.__MONGO_MEMORY_SERVER__ = mongoServer;
};
