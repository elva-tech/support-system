const ApiError = require("../utils/ApiError");
const env = require("../../config/env");

const internalApiAuth = (req, res, next) => {
  const apiKey = req.headers["x-internal-api-key"];

  if (!apiKey || apiKey !== env.internalApiKey) {
    return next(new ApiError(401, "Invalid internal API key"));
  }

  next();
};

module.exports = internalApiAuth;
