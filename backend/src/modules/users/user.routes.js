const express = require("express");
const userController = require("./user.controller");
const {
  createUserValidation,
  inviteUserValidation,
  updateUserValidation,
  idParamValidation
} = require("./user.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const {
  requireTenantContext,
  requireTenantMembership
} = require("../../shared/middleware/tenant-context.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);
router.use(requireTenantContext);
router.use(requireTenantMembership);

router.get("/", userController.list);

router.post(
  "/invite",
  authorize(ROLES.ADMIN),
  inviteUserValidation,
  validate,
  userController.invite
);

router.get("/:id", idParamValidation, validate, userController.getById);

router.post(
  "/",
  authorize(ROLES.ADMIN),
  createUserValidation,
  validate,
  userController.create
);

router.put(
  "/:id",
  authorize(ROLES.ADMIN),
  updateUserValidation,
  validate,
  userController.update
);

router.delete(
  "/:id",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  userController.remove
);

router.post(
  "/:id/resend-invitation",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  userController.resendInvitation
);

router.post(
  "/:id/revoke-invitation",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  userController.revokeInvitation
);

router.post(
  "/:id/suspend",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  userController.suspend
);

router.post(
  "/:id/reactivate",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  userController.reactivate
);

router.post(
  "/:id/deactivate",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  userController.deactivate
);

module.exports = router;
