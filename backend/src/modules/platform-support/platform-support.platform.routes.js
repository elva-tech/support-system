/**
 * Legacy platform-admin support-ticket routes — retired.
 * Central Support operations live under /api/central-support/*.
 */
const express = require("express");
const asyncHandler = require("../../shared/utils/asyncHandler");
const {
  authenticatePlatformAdmin,
  requirePlatformRole
} = require("../../shared/middleware/platform-auth.middleware");
const { PLATFORM_ROLES } = require("../../shared/constants/platform");
const ApiError = require("../../shared/utils/ApiError");

const router = express.Router();
const { PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT } = PLATFORM_ROLES;

const gone = asyncHandler(async () => {
  throw new ApiError(
    410,
    "Central Support operations moved to support.elvasupport.in (/api/central-support). Platform Admin identities are not support assignees."
  );
});

router.use(authenticatePlatformAdmin);
router.use(requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT));
router.use("/support-tickets", gone);

module.exports = router;
