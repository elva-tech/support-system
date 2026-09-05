const express = require("express");
const controller = require("./tenant-provisioning.controller");
const validate = require("../../shared/middleware/validate.middleware");
const {
  authenticatePlatformAdmin,
  requirePlatformRole
} = require("../../shared/middleware/platform-auth.middleware");
const { PLATFORM_ROLES } = require("../../shared/constants/platform");
const {
  provisionTenantValidation,
  provisioningIdParam,
  listProvisioningsValidation
} = require("./tenant-provisioning.validation");

const router = express.Router();
const { PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT } = PLATFORM_ROLES;

/**
 * Preferred business onboarding workflow.
 * Must be registered before /tenants/:tenantId routes.
 */
router.post(
  "/tenants/provision",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  provisionTenantValidation,
  validate,
  controller.provisionTenant
);

router.get(
  "/provisionings",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT),
  listProvisioningsValidation,
  validate,
  controller.listProvisionings
);

router.get(
  "/provisionings/:provisioningId",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT),
  provisioningIdParam,
  validate,
  controller.getProvisioning
);

router.post(
  "/provisionings/:provisioningId/retry",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  provisioningIdParam,
  validate,
  controller.retryProvisioning
);

router.post(
  "/provisionings/:provisioningId/resend-invitation",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  provisioningIdParam,
  validate,
  controller.resendInvitation
);

module.exports = router;
