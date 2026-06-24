const { body } = require("express-validator");

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

module.exports = {
  requestOtpValidation,
  verifyOtpValidation,
  syncMerchantValidation
};
