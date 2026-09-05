const { body, param, query } = require("express-validator");
const { ALL_INTEGRITY_COLLECTIONS, INTEGRITY_SEVERITY, INTEGRITY_ISSUE_TYPES } = require("./integrity.constants");

const collectionParam = [
  param("collection").isIn(ALL_INTEGRITY_COLLECTIONS).withMessage("Invalid collection")
];

const listFindingsValidation = [
  query("collection").optional().isIn(ALL_INTEGRITY_COLLECTIONS),
  query("severity").optional().isIn(Object.values(INTEGRITY_SEVERITY)),
  query("issueType").optional().isIn(Object.values(INTEGRITY_ISSUE_TYPES)),
  query("repairable").optional().isIn(["true", "false"]),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 })
];

const repairValidation = [
  body("collection").isIn(ALL_INTEGRITY_COLLECTIONS).withMessage("Invalid collection"),
  body("recordId").isMongoId().withMessage("Invalid record id"),
  body("tenantId").isMongoId().withMessage("Invalid tenant id"),
  body("confirmation").equals("true").withMessage("confirmation must be true")
];

// express-validator equals("true") checks string — also accept boolean true
const repairValidationFlexible = [
  body("collection").isIn(ALL_INTEGRITY_COLLECTIONS).withMessage("Invalid collection"),
  body("recordId").isMongoId().withMessage("Invalid record id"),
  body("tenantId").isMongoId().withMessage("Invalid tenant id"),
  body("confirmation")
    .custom((value) => value === true || value === "true")
    .withMessage("confirmation must be true")
];

const repairAutoValidation = [
  body("collection").isIn(ALL_INTEGRITY_COLLECTIONS).withMessage("Invalid collection"),
  body("dryRun").optional().isBoolean(),
  body("confirmation").optional(),
  body("limit").optional().isInt({ min: 1, max: 50 })
];

const scanValidation = [
  body("collections").optional().isArray(),
  body("collections.*").optional().isIn(ALL_INTEGRITY_COLLECTIONS)
];

module.exports = {
  collectionParam,
  listFindingsValidation,
  repairValidation: repairValidationFlexible,
  repairAutoValidation,
  scanValidation
};
