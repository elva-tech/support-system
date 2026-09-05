const express = require("express");
const workspaceController = require("./workspace.controller");
const {
  organizationValidation,
  brandingValidation,
  supportValidation,
  skipStepValidation
} = require("./workspace.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const {
  requireTenantContext,
  requireTenantMembership
} = require("../../shared/middleware/tenant-context.middleware");
const { handleLogoUpload } = require("../../shared/middleware/logo-upload.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

/**
 * Public branding (tenant context required, no staff JWT).
 * Used by login / landing to show tenant display name + logo.
 */
router.get(
  "/branding/public",
  requireTenantContext,
  workspaceController.getPublicBranding
);

router.get("/branding/logo", requireTenantContext, workspaceController.streamLogo);

router.use(authenticate);
router.use(requireTenantContext);
router.use(requireTenantMembership);

router.get("/settings", workspaceController.getSettings);
router.get("/setup-status", workspaceController.getSetupStatus);

router.patch(
  "/organization",
  authorize(ROLES.ADMIN),
  organizationValidation,
  validate,
  workspaceController.updateOrganization
);

router.patch(
  "/branding",
  authorize(ROLES.ADMIN),
  brandingValidation,
  validate,
  workspaceController.updateBranding
);

router.patch(
  "/support",
  authorize(ROLES.ADMIN),
  supportValidation,
  validate,
  workspaceController.updateSupport
);

router.post(
  "/branding/logo",
  authorize(ROLES.ADMIN),
  handleLogoUpload,
  workspaceController.uploadLogo
);

router.delete(
  "/branding/logo",
  authorize(ROLES.ADMIN),
  workspaceController.deleteLogo
);

router.post(
  "/setup/skip/:step",
  authorize(ROLES.ADMIN),
  skipStepValidation,
  validate,
  workspaceController.skipStep
);

module.exports = router;
