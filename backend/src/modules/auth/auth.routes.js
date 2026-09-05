const express = require("express");
const authController = require("./auth.controller");
const { loginValidation } = require("./auth.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const { loginLimiter } = require("../../shared/middleware/rate-limit.middleware");
const { requireTenantContext } = require("../../shared/middleware/tenant-context.middleware");

const router = express.Router();

router.post(
  "/login",
  loginLimiter,
  requireTenantContext,
  loginValidation,
  validate,
  authController.login
);
router.get("/me", authenticate, authController.getMe);

module.exports = router;
