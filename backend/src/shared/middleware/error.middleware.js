const ApiError = require("../utils/ApiError");

const errorHandler = (err, req, res, next) => {
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid resource identifier" });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({ message: `${field} already exists` });
  }

  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({ message: "Validation failed", errors });
  }

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  if (!err.isOperational) {
    console.error(err);
  }

  res.status(statusCode).json({
    message,
    ...(err.errors && { errors: err.errors })
  });
};

module.exports = errorHandler;
