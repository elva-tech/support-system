const express = require("express");
const userController = require("./user.controller");
const {
  createUserValidation,
  updateUserValidation,
  idParamValidation
} = require("./user.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);

router.get("/", userController.list);
router.get("/:id", idParamValidation, validate, userController.getById);
router.post(
  "/",
  authorize(ROLES.ADMIN),
  createUserValidation,
  validate,
  userController.create
);
router.put(
  "/:id",
  authorize(ROLES.ADMIN),
  updateUserValidation,
  validate,
  userController.update
);
router.delete(
  "/:id",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  userController.remove
);

module.exports = router;
