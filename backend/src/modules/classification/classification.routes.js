const express = require("express");
const classificationController = require("./classification.controller");
const {
  createProfileValidation,
  updateProfileValidation,
  classifyValidation,
  resolveQueueValidation,
  dismissQueueValidation,
  listQueueValidation,
  idParamValidation
} = require("./classification.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);

router.post(
  "/classify",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD, ROLES.AGENT),
  classifyValidation,
  validate,
  classificationController.classify
);

router.get(
  "/queue",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  listQueueValidation,
  validate,
  classificationController.listQueue
);

router.get(
  "/queue/:id",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  idParamValidation,
  validate,
  classificationController.getQueueItem
);

router.patch(
  "/queue/:id/resolve",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  resolveQueueValidation,
  validate,
  classificationController.resolveQueueItem
);

router.patch(
  "/queue/:id/dismiss",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  dismissQueueValidation,
  validate,
  classificationController.dismissQueueItem
);

router.get(
  "/profiles",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  classificationController.listProfiles
);

router.get(
  "/profiles/:id",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  idParamValidation,
  validate,
  classificationController.getProfile
);

router.post(
  "/profiles",
  authorize(ROLES.ADMIN),
  createProfileValidation,
  validate,
  classificationController.createProfile
);

router.put(
  "/profiles/:id",
  authorize(ROLES.ADMIN),
  updateProfileValidation,
  validate,
  classificationController.updateProfile
);

module.exports = router;
