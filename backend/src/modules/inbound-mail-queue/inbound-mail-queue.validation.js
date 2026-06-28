const { body, param, query } = require("express-validator");

const assignValidation = [
  param("id").isMongoId(),
  body("teamId").isMongoId().withMessage("Team is required"),
  body("applicationId").isMongoId().withMessage("Application is required"),
  body("moduleId").isMongoId().withMessage("Module is required"),
  body("notes").optional().isString().trim()
];

const rejectValidation = [
  param("id").isMongoId(),
  body("reason").trim().notEmpty().withMessage("Rejection reason is required")
];

const listValidation = [
  query("status").optional().isIn(["PENDING", "ASSIGNED", "REJECTED"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 })
];

const idParamValidation = [param("id").isMongoId()];

module.exports = {
  assignValidation,
  rejectValidation,
  listValidation,
  idParamValidation
};
