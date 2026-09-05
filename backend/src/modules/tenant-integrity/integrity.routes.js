const express = require("express");
const controller = require("./integrity.controller");
const validate = require("../../shared/middleware/validate.middleware");
const {
  authenticatePlatformAdmin,
  requirePlatformRole
} = require("../../shared/middleware/platform-auth.middleware");
const { PLATFORM_ROLES } = require("../../shared/constants/platform");
const {
  listFindingsValidation,
  collectionParam,
  repairValidation,
  repairAutoValidation,
  scanValidation
} = require("./integrity.validation");
const { param } = require("express-validator");

const router = express.Router();
const { PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN } = PLATFORM_ROLES;

router.use(authenticatePlatformAdmin);

// Read-only diagnostics: SUPER_ADMIN + PLATFORM_ADMIN
router.get(
  "/summary",
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  controller.getSummary
);

router.get(
  "/findings",
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  listFindingsValidation,
  validate,
  controller.listFindings
);

router.get(
  "/findings/:collection/:recordId",
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  collectionParam,
  param("recordId").isMongoId(),
  validate,
  controller.getFinding
);

router.post(
  "/scan",
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  scanValidation,
  validate,
  controller.scan
);

// Repairs: SUPER_ADMIN only
router.post(
  "/repair",
  requirePlatformRole(PLATFORM_SUPER_ADMIN),
  repairValidation,
  validate,
  controller.repair
);

router.post(
  "/repair-auto",
  requirePlatformRole(PLATFORM_SUPER_ADMIN),
  repairAutoValidation,
  validate,
  controller.repairAutoEndpoint
);

module.exports = router;
