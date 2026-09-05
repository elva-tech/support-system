const express = require("express");
const merchantController = require("./merchant.controller");
const { requestOtpValidation, verifyOtpValidation } = require("./merchant.validation");
const validate = require("../../shared/middleware/validate.middleware");
const merchantAuthenticate = require("../../shared/middleware/merchant-auth.middleware");
const { otpLimiter } = require("../../shared/middleware/rate-limit.middleware");
const {
  requireTenantContext,
  requireMerchantTenantMembership
} = require("../../shared/middleware/tenant-context.middleware");
const merchantTicketRoutes = require("../tickets/merchant-ticket.routes");

const router = express.Router();

router.post(
  "/request-otp",
  requireTenantContext,
  otpLimiter,
  requestOtpValidation,
  validate,
  merchantController.requestOtp
);
router.post(
  "/verify-otp",
  requireTenantContext,
  otpLimiter,
  verifyOtpValidation,
  validate,
  merchantController.verifyOtp
);
router.get(
  "/me",
  requireTenantContext,
  merchantAuthenticate,
  requireMerchantTenantMembership,
  merchantController.getMe
);
router.post(
  "/logout",
  requireTenantContext,
  merchantAuthenticate,
  requireMerchantTenantMembership,
  merchantController.logout
);
router.use("/tickets", merchantTicketRoutes);

module.exports = router;
