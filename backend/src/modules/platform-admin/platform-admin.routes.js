const express = require("express");
const controller = require("./platform-admin.controller");
const validate = require("../../shared/middleware/validate.middleware");
const { loginLimiter } = require("../../shared/middleware/rate-limit.middleware");
const {
  authenticatePlatformAdmin,
  requirePlatformRole
} = require("../../shared/middleware/platform-auth.middleware");
const { PLATFORM_ROLES } = require("../../shared/constants/platform");
const {
  platformLoginValidation,
  createPlatformAdminValidation,
  updatePlatformAdminValidation,
  createTenantValidation,
  updateTenantValidation,
  tenantIdParam,
  listTenantsValidation,
  listAdminsValidation,
  listAuditValidation
} = require("./platform-admin.http-validation");

const router = express.Router();

const {
  PLATFORM_SUPER_ADMIN,
  PLATFORM_ADMIN,
  PLATFORM_SUPPORT
} = PLATFORM_ROLES;

// --- Auth (no tenant context) ---
router.post(
  "/auth/login",
  loginLimiter,
  platformLoginValidation,
  validate,
  controller.login
);
router.get("/auth/me", authenticatePlatformAdmin, controller.getMe);

// --- Platform admins (super admin manage; platform admin can create non-super) ---
router.get(
  "/admins",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  listAdminsValidation,
  validate,
  controller.listAdmins
);
router.post(
  "/admins",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  createPlatformAdminValidation,
  validate,
  controller.createAdmin
);
router.patch(
  "/admins/:adminId",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  updatePlatformAdminValidation,
  validate,
  controller.updateAdmin
);

// --- Tenants ---
router.post(
  "/tenants",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  createTenantValidation,
  validate,
  controller.createTenant
);
router.get(
  "/tenants",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT),
  listTenantsValidation,
  validate,
  controller.listTenants
);
router.get(
  "/tenants/:tenantId",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, PLATFORM_SUPPORT),
  tenantIdParam,
  validate,
  controller.getTenant
);
router.patch(
  "/tenants/:tenantId",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  updateTenantValidation,
  validate,
  controller.updateTenant
);
router.post(
  "/tenants/:tenantId/activate",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  tenantIdParam,
  validate,
  controller.activateTenant
);
router.post(
  "/tenants/:tenantId/suspend",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  tenantIdParam,
  validate,
  controller.suspendTenant
);
router.post(
  "/tenants/:tenantId/cancel",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  tenantIdParam,
  validate,
  controller.cancelTenant
);
router.post(
  "/tenants/:tenantId/archive",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  tenantIdParam,
  validate,
  controller.archiveTenant
);

// --- Audit (read-only for super + platform admin) ---
router.get(
  "/audit",
  authenticatePlatformAdmin,
  requirePlatformRole(PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN),
  listAuditValidation,
  validate,
  controller.listAudit
);

module.exports = router;
