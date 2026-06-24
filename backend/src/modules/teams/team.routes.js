const express = require("express");
const teamController = require("./team.controller");
const {
  createTeamValidation,
  updateTeamValidation,
  idParamValidation
} = require("./team.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);

router.get("/", teamController.list);
router.get("/:id", idParamValidation, validate, teamController.getById);
router.post(
  "/",
  authorize(ROLES.ADMIN),
  createTeamValidation,
  validate,
  teamController.create
);
router.put(
  "/:id",
  authorize(ROLES.ADMIN),
  updateTeamValidation,
  validate,
  teamController.update
);
router.delete(
  "/:id",
  authorize(ROLES.ADMIN),
  idParamValidation,
  validate,
  teamController.remove
);

module.exports = router;
