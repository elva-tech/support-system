const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const env = require("../../config/env");
const User = require("../../modules/users/user.model");

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.sub)
      .select("-password")
      .populate("teamId", "name")
      .populate("applicationIds", "name code");

    if (!user || !user.isActive) {
      return next(new ApiError(401, "Invalid or inactive account"));
    }

    req.user = user;
    next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
};

module.exports = authenticate;
