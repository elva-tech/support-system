const { body, param } = require("express-validator");

const createTeamValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("applicationId").isMongoId().withMessage("Valid application id is required"),
  body("description").optional().trim(),
  body("moduleIds").optional().isArray().withMessage("moduleIds must be an array"),
  body("moduleIds.*").optional().isMongoId().withMessage("Invalid module id"),
  body("teamLeadId").optional({ nullable: true }).isMongoId().withMessage("Invalid team lead id"),
  body("memberIds").optional().isArray().withMessage("memberIds must be an array"),
  body("memberIds.*").optional().isMongoId().withMessage("Invalid member id"),
  body("isActive").optional().isBoolean()
];

const updateTeamValidation = [
  param("id").isMongoId().withMessage("Invalid team id"),
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("applicationId").optional().isMongoId().withMessage("Valid application id is required"),
  body("description").optional().trim(),
  body("moduleIds").optional().isArray().withMessage("moduleIds must be an array"),
  body("moduleIds.*").optional().isMongoId().withMessage("Invalid module id"),
  body("teamLeadId").optional({ nullable: true }).isMongoId().withMessage("Invalid team lead id"),
  body("memberIds").optional().isArray().withMessage("memberIds must be an array"),
  body("memberIds.*").optional().isMongoId().withMessage("Invalid member id"),
  body("isActive").optional().isBoolean()
];

const idParamValidation = [param("id").isMongoId().withMessage("Invalid team id")];

module.exports = {
  createTeamValidation,
  updateTeamValidation,
  idParamValidation
};
