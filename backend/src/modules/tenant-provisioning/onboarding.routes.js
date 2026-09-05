const express = require("express");
const controller = require("./tenant-provisioning.controller");
const validate = require("../../shared/middleware/validate.middleware");
const { onboardingLimiter } = require("../../shared/middleware/rate-limit.middleware");
const {
  completeSetupValidation,
  invitationTokenParam
} = require("./tenant-provisioning.validation");

const router = express.Router();

router.get(
  "/invitation/:token",
  onboardingLimiter,
  invitationTokenParam,
  validate,
  controller.getInvitation
);

router.post(
  "/complete-setup",
  onboardingLimiter,
  completeSetupValidation,
  validate,
  controller.completeSetup
);

module.exports = router;
