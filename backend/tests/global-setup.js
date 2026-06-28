const { MongoMemoryServer } = require("mongodb-memory-server");

module.exports = async () => {
  const mongoServer = await MongoMemoryServer.create();
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongoServer.getUri();
  global.__MONGO_MEMORY_SERVER__ = mongoServer;
};
