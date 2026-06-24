const express = require("express");
const moduleController = require("./module.controller");
const {
  createModuleValidation,
  updateModuleValidation,
  idParamValidation
} = require("./module.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);

router.get("/", moduleController.list);
router.get("/:id", idParamValidation, validate, moduleController.getById);
router.post(
  "/",
  authorize(ROLES.ADMIN),
  createModuleValidation,
  validate,
  moduleController.create
);
router.put(
  "/:id",
  authorize(ROLES.ADMIN),
  updateModuleValidation,
  validate,
  moduleController.update
);
router.delete(
  "/:id",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  moduleController.remove
);

module.exports = router;
