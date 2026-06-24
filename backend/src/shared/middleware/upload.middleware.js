const multer = require("multer");
const path = require("path");
const ApiError = require("../utils/ApiError");
const env = require("../../config/env");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".js",
  ".jar",
  ".msi",
  ".dll",
  ".com",
  ".scr"
]);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: env.uploadMaxFileSize },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname) {
      return cb(new ApiError(400, "Invalid file"));
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(extension)) {
      return cb(new ApiError(400, `File type not allowed: ${extension}`));
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new ApiError(400, `File type not allowed: ${file.mimetype}`));
    }

    cb(null, true);
  }
});

const singleUpload = upload.single("file");

const handleUpload = (req, res, next) => {
  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const maxMb = Math.round(env.uploadMaxFileSize / (1024 * 1024));
      return next(
        new ApiError(400, err.code === "LIMIT_FILE_SIZE" ? `File too large (max ${maxMb}MB)` : err.message)
      );
    }
    if (err) {
      return next(err);
    }
    if (!req.file) {
      return next(new ApiError(400, "File is required"));
    }
    next();
  });
};

module.exports = { handleUpload, ALLOWED_MIME_TYPES, BLOCKED_EXTENSIONS };
