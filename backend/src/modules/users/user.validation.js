const { body, param } = require("express-validator");
const { ALL_ROLES } = require("../../shared/constants/roles");

const createUserValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("role").isIn(ALL_ROLES).withMessage(`Role must be one of: ${ALL_ROLES.join(", ")}`),
  body("teamId").optional({ nullable: true }).isMongoId().withMessage("Invalid team id"),
  body("applicationIds").optional().isArray().withMessage("applicationIds must be an array"),
  body("applicationIds.*").optional().isMongoId().withMessage("Invalid application id"),
  body("isActive").optional().isBoolean()
];

const updateUserValidation = [
  param("id").isMongoId().withMessage("Invalid user id"),
  body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .optional()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  body("firstName").optional().trim().notEmpty().withMessage("First name cannot be empty"),
  body("lastName").optional().trim().notEmpty().withMessage("Last name cannot be empty"),
  body("role").optional().isIn(ALL_ROLES).withMessage(`Role must be one of: ${ALL_ROLES.join(", ")}`),
  body("teamId").optional({ nullable: true }).isMongoId().withMessage("Invalid team id"),
  body("applicationIds").optional().isArray().withMessage("applicationIds must be an array"),
  body("applicationIds.*").optional().isMongoId().withMessage("Invalid application id"),
  body("isActive").optional().isBoolean()
];

const idParamValidation = [param("id").isMongoId().withMessage("Invalid user id")];

module.exports = {
  createUserValidation,
  updateUserValidation,
  idParamValidation
};
