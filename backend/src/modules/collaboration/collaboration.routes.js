const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const validate = require("../../shared/middleware/validate.middleware");
const asyncHandler = require("../../shared/utils/asyncHandler");
const env = require("../../config/env");
const collaborationService = require("./collaboration.service");
const { SECURITY_EVENTS, logSecurityEvent } = require("../../shared/observability/security-events");
const ApiError = require("../../shared/utils/ApiError");

const router = express.Router();

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !env.rateLimit.enabled,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || "unknown",
  handler: (req, _res, next) => {
    logSecurityEvent(SECURITY_EVENTS.AUTH_RATE_LIMITED, req, { kind: "collaborate_enquiry" });
    next(new ApiError(429, "Too many enquiries. Please try again later."));
  }
});

const enquiryValidation = [
  body("organizationName").trim().notEmpty().isLength({ max: 200 }),
  body("contactPerson").trim().notEmpty().isLength({ max: 200 }),
  body("businessEmail").isEmail().normalizeEmail().isLength({ max: 200 }),
  body("phone").optional({ checkFalsy: true }).isString().isLength({ max: 50 }),
  body("organizationWebsite").optional({ checkFalsy: true }).isString().isLength({ max: 300 }),
  body("expectedTeamSize").optional({ checkFalsy: true }).isString().isLength({ max: 50 }),
  body("message").trim().notEmpty().isLength({ max: 5000 })
];

router.post(
  "/enquiries",
  enquiryLimiter,
  enquiryValidation,
  validate,
  asyncHandler(async (req, res) => {
    const data = await collaborationService.createEnquiry(req.body, {
      sourceHost: req.get("host") || ""
    });
    res.status(201).json({
      message: "Enquiry submitted successfully. ELVA will contact you soon.",
      data
    });
  })
);

module.exports = router;
