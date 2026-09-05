const express = require("express");
const controller = require("./tenant-provisioning.controller");
const validate = require("../../shared/middleware/validate.middleware");
const { loginLimiter } = require("../../shared/middleware/rate-limit.middleware");
const {
  completeSetupValidation,
  invitationTokenParam
} = require("./tenant-provisioning.validation");

const router = express.Router();

router.get(
  "/invitation/:token",
  loginLimiter,
  invitationTokenParam,
  validate,
  controller.getInvitation
);

router.post(
  "/complete-setup",
  loginLimiter,
  completeSetupValidation,
  validate,
  controller.completeSetup
);

module.exports = router;
