const { body, param } = require("express-validator");

const requestOtpValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail()
];

const verifyOtpValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("otpCode")
    .trim()
    .notEmpty()
    .withMessage("OTP code is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must be numeric")
];

const syncMerchantValidation = [
  body("applicationCode")
    .trim()
    .notEmpty()
    .withMessage("Application code is required"),
  body("externalUserId").trim().notEmpty().withMessage("External user id is required"),
  body("merchantName").trim().notEmpty().withMessage("Merchant name is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("phone").optional().trim(),
  body("isActive").optional().isBoolean()
];

const createMerchantValidation = [
  body("applicationId").isMongoId().withMessage("Valid application id is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("merchantName").optional().trim().isLength({ max: 120 }),
  body("phone").optional().trim(),
  body("isActive").optional().isBoolean()
];

const updateMerchantValidation = [
  body("applicationId").optional().isMongoId().withMessage("Valid application id is required"),
  body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("merchantName").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 120 }),
  body("phone").optional().trim(),
  body("isActive").optional().isBoolean()
];

const merchantIdParamValidation = [param("id").isMongoId().withMessage("Invalid merchant id")];

module.exports = {
  requestOtpValidation,
  verifyOtpValidation,
  syncMerchantValidation,
  createMerchantValidation,
  updateMerchantValidation,
  merchantIdParamValidation
};
