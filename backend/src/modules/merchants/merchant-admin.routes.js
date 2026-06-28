const express = require("express");
const merchantAdminController = require("./merchant-admin.controller");
const {
  createMerchantValidation,
  updateMerchantValidation,
  merchantIdParamValidation
} = require("./merchant.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

router.get("/", merchantAdminController.list);
router.post("/", createMerchantValidation, validate, merchantAdminController.create);
router.put(
  "/:id",
  merchantIdParamValidation,
  updateMerchantValidation,
  validate,
  merchantAdminController.update
);

module.exports = router;
