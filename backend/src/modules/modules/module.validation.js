const { body, param } = require("express-validator");

const createModuleValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Code is required")
    .isLength({ max: 20 })
    .withMessage("Code must be at most 20 characters"),
  body("applicationId").isMongoId().withMessage("Valid application id is required"),
  body("description").optional().trim(),
  body("defaultTeamId").optional({ nullable: true }).isMongoId().withMessage("Invalid default team id"),
  body("isActive").optional().isBoolean()
];

const updateModuleValidation = [
  param("id").isMongoId().withMessage("Invalid module id"),
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("code")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Code cannot be empty")
    .isLength({ max: 20 })
    .withMessage("Code must be at most 20 characters"),
  body("applicationId").optional().isMongoId().withMessage("Valid application id is required"),
  body("description").optional().trim(),
  body("defaultTeamId").optional({ nullable: true }).isMongoId().withMessage("Invalid default team id"),
  body("isActive").optional().isBoolean()
];

const idParamValidation = [param("id").isMongoId().withMessage("Invalid module id")];

module.exports = {
  createModuleValidation,
  updateModuleValidation,
  idParamValidation
};
