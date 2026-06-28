const mongoose = require("mongoose");
const env = require("./env");
const { getDatabaseName } = require("./db-safety");
const logger = require("../shared/utils/logger");

const connectDatabase = async () => {
  mongoose.set("strictQuery", true);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(env.mongodbUri);

  const TicketConversation = require("../modules/conversations/ticket-conversation.model");
  await TicketConversation.syncIndexes();

  const dbName = getDatabaseName(env.mongodbUri);
  logger.info("MongoDB connected", {
    database: dbName,
    nodeEnv: env.nodeEnv
  });
  console.log(`MongoDB connected → database: ${dbName}`);
};

module.exports = { connectDatabase };
