module.exports = async () => {
  const mongoServer = global.__MONGO_MEMORY_SERVER__;
  if (mongoServer) {
    await mongoServer.stop();
  }
};
