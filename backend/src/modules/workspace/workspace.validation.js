const { body, param } = require("express-validator");
const { PRIMARY_COLOR_PATTERN } = require("../../shared/constants/workspace-setup");
const { ALL_CUSTOMER_LABELS } = require("../../shared/constants/customer-labels");

const hexColorOptional = (field) =>
  body(field)
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === "") {
        return true;
      }
      if (!PRIMARY_COLOR_PATTERN.test(String(value).trim())) {
        throw new Error(`${field} must be a hex color (#RGB or #RRGGBB)`);
      }
      return true;
    });

const organizationValidation = [
  body("displayName").optional().isString().trim().isLength({ max: 200 }),
  body("legalName").optional().isString().trim().isLength({ max: 200 }),
  body("supportDisplayName").optional().isString().trim().isLength({ max: 120 }),
  body("primaryContactName").optional().isString().trim().isLength({ max: 200 }),
  body("primaryContactEmail").optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body("supportEmail").optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body("phone").optional().isString().trim().isLength({ max: 50 }),
  body("website").optional({ checkFalsy: true }).isString().trim().isLength({ max: 300 }),
  body("timezone").optional().isString().trim().isLength({ max: 80 }),
  body("country").optional().isString().trim().isLength({ max: 80 }),
  body("address").optional().isString().trim().isLength({ max: 500 })
];

const brandingValidation = [
  body("supportDisplayName").optional().isString().trim().isLength({ max: 120 }),
  hexColorOptional("primaryColor"),
  hexColorOptional("secondaryColor"),
  body("loginTitle").optional({ nullable: true }).isString().trim().isLength({ max: 160 }),
  body("loginSubtitle").optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
  body("faviconUrl").optional({ nullable: true }).isString().trim().isLength({ max: 500 })
];

const supportValidation = [
  body("customerLabel")
    .optional()
    .isString()
    .trim()
    .custom((value) => {
      const upper = String(value || "").toUpperCase();
      if (!ALL_CUSTOMER_LABELS.includes(upper)) {
        throw new Error(`customerLabel must be one of: ${ALL_CUSTOMER_LABELS.join(", ")}`);
      }
      return true;
    }),
  body("supportDisplayName").optional().isString().trim().isLength({ max: 120 }),
  body("supportEmailDisplayName").optional().isString().trim().isLength({ max: 120 })
];

const skipStepValidation = [
  param("step").isIn(["users", "client"]).withMessage("Invalid skippable step")
];

module.exports = {
  organizationValidation,
  brandingValidation,
  supportValidation,
  skipStepValidation
};
