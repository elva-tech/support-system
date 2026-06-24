const { body, param } = require("express-validator");

const createApplicationValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Code is required")
    .isLength({ max: 10 })
    .withMessage("Code must be at most 10 characters"),
  body("description").optional().trim(),
  body("isActive").optional().isBoolean()
];

const updateApplicationValidation = [
  param("id").isMongoId().withMessage("Invalid application id"),
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("code")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Code cannot be empty")
    .isLength({ max: 10 })
    .withMessage("Code must be at most 10 characters"),
  body("description").optional().trim(),
  body("isActive").optional().isBoolean()
];

const idParamValidation = [param("id").isMongoId().withMessage("Invalid application id")];

module.exports = {
  createApplicationValidation,
  updateApplicationValidation,
  idParamValidation
};
