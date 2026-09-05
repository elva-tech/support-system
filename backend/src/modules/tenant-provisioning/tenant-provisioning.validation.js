const { body, param, query } = require("express-validator");
const { ALL_TENANT_STATUSES } = require("../../shared/constants/tenant");
const { ALL_PROVISIONING_STATUSES } = require("../../shared/constants/provisioning");

const provisionTenantValidation = [
  body("tenant").isObject().withMessage("tenant object is required"),
  body("tenant.name").trim().notEmpty().withMessage("tenant.name is required").isLength({ max: 200 }),
  body("tenant.slug").trim().notEmpty().withMessage("tenant.slug is required"),
  body("tenant.status").optional().isIn(ALL_TENANT_STATUSES),
  body("tenant.settings").optional().isObject(),
  body("admin").isObject().withMessage("admin object is required"),
  body("admin.name").trim().notEmpty().withMessage("admin.name is required").isLength({ max: 200 }),
  body("admin.email").isEmail().withMessage("admin.email must be valid").normalizeEmail(),
  body("admin.role").not().exists().withMessage("admin.role cannot be set by client"),
  body("admin.password").not().exists().withMessage("admin.password cannot be set by client"),
  body("tenantId").not().exists()
];

const provisioningIdParam = [
  param("provisioningId").isMongoId().withMessage("Invalid provisioning id")
];

const listProvisioningsValidation = [
  query("status").optional().isIn(ALL_PROVISIONING_STATUSES),
  query("tenantId").optional().isMongoId(),
  query("search").optional().isString(),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("skip").optional().isInt({ min: 0 })
];

const completeSetupValidation = [
  body("token").trim().notEmpty().withMessage("token is required").isLength({ min: 16 }),
  body("password").isLength({ min: 8, max: 128 }).withMessage("Password must be 8–128 characters"),
  body("confirmPassword").optional().isString()
];

const invitationTokenParam = [
  param("token").trim().notEmpty().isLength({ min: 16 }).withMessage("Invalid invitation token")
];

module.exports = {
  provisionTenantValidation,
  provisioningIdParam,
  listProvisioningsValidation,
  completeSetupValidation,
  invitationTokenParam
};
