const { body, param, query } = require("express-validator");

const moduleKeywordValidation = [
  body("modules.*.moduleId").isMongoId().withMessage("Valid module id is required"),
  body("modules.*.keywords").optional().isArray().withMessage("Module keywords must be an array"),
  body("modules.*.keywords.*").optional().isString().trim().notEmpty()
];

const createProfileValidation = [
  body("applicationId").isMongoId().withMessage("Valid application id is required"),
  body("keywords").optional().isArray(),
  body("keywords.*").optional().isString().trim().notEmpty(),
  body("confidenceThreshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("confidenceThreshold must be between 0 and 1"),
  ...moduleKeywordValidation
];

const updateProfileValidation = [
  param("id").isMongoId(),
  body("keywords").optional().isArray(),
  body("keywords.*").optional().isString().trim().notEmpty(),
  body("confidenceThreshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("confidenceThreshold must be between 0 and 1"),
  body("modules").optional().isArray(),
  ...moduleKeywordValidation
];

const classifyValidation = [
  body("senderEmail").isEmail().withMessage("Valid sender email is required").normalizeEmail(),
  body("subject").trim().notEmpty().withMessage("Subject is required"),
  body("body").optional().isString(),
  body("enqueue").optional().isBoolean()
];

const resolveQueueValidation = [
  param("id").isMongoId(),
  body("applicationId").isMongoId().withMessage("Application is required"),
  body("moduleId").isMongoId().withMessage("Module is required"),
  body("notes").optional().isString().trim()
];

const dismissQueueValidation = [
  param("id").isMongoId(),
  body("notes").optional().isString().trim()
];

const listQueueValidation = [
  query("status").optional().isIn(["PENDING", "RESOLVED", "DISMISSED"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 })
];

const idParamValidation = [param("id").isMongoId()];

module.exports = {
  createProfileValidation,
  updateProfileValidation,
  classifyValidation,
  resolveQueueValidation,
  dismissQueueValidation,
  listQueueValidation,
  idParamValidation
};
