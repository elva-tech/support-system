const { body, param, query } = require("express-validator");
const { ALL_PLATFORM_ROLES, ALL_PLATFORM_ADMIN_STATUSES } = require("../../shared/constants/platform");
const { ALL_TENANT_STATUSES } = require("../../shared/constants/tenant");

const platformLoginValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required")
];

const createPlatformAdminValidation = [
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 200 }),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("role").isIn(ALL_PLATFORM_ROLES).withMessage(`Role must be one of: ${ALL_PLATFORM_ROLES.join(", ")}`)
];

const updatePlatformAdminValidation = [
  param("adminId").isMongoId().withMessage("Invalid admin id"),
  body("name").optional().trim().notEmpty().isLength({ max: 200 }),
  body("role").optional().isIn(ALL_PLATFORM_ROLES),
  body("status").optional().isIn(ALL_PLATFORM_ADMIN_STATUSES)
];

const createTenantValidation = [
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 200 }),
  body("slug").trim().notEmpty().withMessage("Slug is required"),
  body("status").optional().isIn(ALL_TENANT_STATUSES),
  body("settings").optional().isObject()
];

const updateTenantValidation = [
  param("tenantId").isMongoId().withMessage("Invalid tenant id"),
  body("name").optional().trim().notEmpty().isLength({ max: 200 }),
  body("settings").optional().isObject(),
  body("slug").not().exists().withMessage("Slug cannot be changed via PATCH"),
  body("status").not().exists().withMessage("Use lifecycle endpoints to change status")
];

const tenantIdParam = [param("tenantId").isMongoId().withMessage("Invalid tenant id")];

const listTenantsValidation = [
  query("status").optional().isIn(ALL_TENANT_STATUSES),
  query("search").optional().isString(),
  query("slug").optional().isString(),
  query("name").optional().isString(),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("skip").optional().isInt({ min: 0 })
];

const listAdminsValidation = [
  query("status").optional().isIn(ALL_PLATFORM_ADMIN_STATUSES),
  query("role").optional().isIn(ALL_PLATFORM_ROLES),
  query("search").optional().isString(),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("skip").optional().isInt({ min: 0 })
];

const listAuditValidation = [
  query("action").optional().isString(),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("skip").optional().isInt({ min: 0 })
];

module.exports = {
  platformLoginValidation,
  createPlatformAdminValidation,
  updatePlatformAdminValidation,
  createTenantValidation,
  updateTenantValidation,
  tenantIdParam,
  listTenantsValidation,
  listAdminsValidation,
  listAuditValidation
};
