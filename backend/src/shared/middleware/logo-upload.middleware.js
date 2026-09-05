const multer = require("multer");
const path = require("path");
const ApiError = require("../utils/ApiError");
const {
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_BYTES
} = require("../constants/workspace-setup");

const ALLOWED = new Set(LOGO_ALLOWED_MIME_TYPES);
const ALLOWED_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: LOGO_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname) {
      return cb(new ApiError(400, "Invalid file"));
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(extension)) {
      return cb(new ApiError(400, `Logo extension not allowed: ${extension}`));
    }

    if (file.mimetype && !ALLOWED.has(file.mimetype)) {
      return cb(new ApiError(400, `Logo type not allowed: ${file.mimetype}`));
    }

    cb(null, true);
  }
});

const singleUpload = upload.single("file");

const handleLogoUpload = (req, res, next) => {
  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(
        new ApiError(
          400,
          err.code === "LIMIT_FILE_SIZE" ? "Logo too large (max 2MB)" : err.message
        )
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

module.exports = { handleLogoUpload };
