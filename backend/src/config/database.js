const mongoose = require("mongoose");
const env = require("./env");

const connectDatabase = async () => {
  mongoose.set("strictQuery", true);

  await mongoose.connect(env.mongodbUri);
  console.log("MongoDB connected");
};

module.exports = { connectDatabase };
