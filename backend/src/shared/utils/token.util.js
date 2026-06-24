const crypto = require("crypto");

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const generateSessionToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const hashValue = (value) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

module.exports = { generateOtp, generateSessionToken, hashValue };
