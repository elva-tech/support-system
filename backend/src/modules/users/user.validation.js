const { body, param } = require("express-validator");
const { ALL_ROLES } = require("../../shared/constants/roles");
const { ALL_USER_STATUSES } = require("../../shared/constants/user-lifecycle");

/** Phase 10: invite staff — no password field */
const inviteUserValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("role").isIn(ALL_ROLES).withMessage(`Role must be one of: ${ALL_ROLES.join(", ")}`),
  body("teamId").optional({ nullable: true }).isMongoId().withMessage("Invalid team id"),
  body("applicationIds").optional().isArray().withMessage("applicationIds must be an array"),
  body("applicationIds.*").optional().isMongoId().withMessage("Invalid application id"),
  body("password").not().exists().withMessage("Password must not be supplied when inviting users")
];

/** @deprecated alias — same as invite (no password) */
const createUserValidation = inviteUserValidation;

const updateUserValidation = [
  param("id").isMongoId().withMessage("Invalid user id"),
  body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .optional()
    .custom(() => {
      throw new Error("Password cannot be set by administrators; use invitation flow");
    }),
  body("firstName").optional().trim().notEmpty().withMessage("First name cannot be empty"),
  body("lastName").optional().trim().notEmpty().withMessage("Last name cannot be empty"),
  body("role").optional().isIn(ALL_ROLES).withMessage(`Role must be one of: ${ALL_ROLES.join(", ")}`),
  body("teamId").optional({ nullable: true }).isMongoId().withMessage("Invalid team id"),
  body("applicationIds").optional().isArray().withMessage("applicationIds must be an array"),
  body("applicationIds.*").optional().isMongoId().withMessage("Invalid application id"),
  body("isActive").optional().isBoolean(),
  body("status").optional().isIn(ALL_USER_STATUSES).withMessage("Invalid user status")
];

const idParamValidation = [param("id").isMongoId().withMessage("Invalid user id")];

module.exports = {
  createUserValidation,
  inviteUserValidation,
  updateUserValidation,
  idParamValidation
};
