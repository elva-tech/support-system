const express = require("express");
const applicationController = require("./application.controller");
const {
  createApplicationValidation,
  updateApplicationValidation,
  idParamValidation
} = require("./application.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);

router.get("/", applicationController.list);
router.get("/:id", idParamValidation, validate, applicationController.getById);
router.post(
  "/",
  authorize(ROLES.ADMIN),
  createApplicationValidation,
  validate,
  applicationController.create
);
router.put(
  "/:id",
  authorize(ROLES.ADMIN),
  updateApplicationValidation,
  validate,
  applicationController.update
);
router.delete(
  "/:id",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  applicationController.remove
);

module.exports = router;
