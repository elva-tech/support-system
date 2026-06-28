const express = require("express");
const inboundMailQueueController = require("./inbound-mail-queue.controller");
const {
  assignValidation,
  rejectValidation,
  listValidation,
  idParamValidation
} = require("./inbound-mail-queue.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

router.get("/", listValidation, validate, inboundMailQueueController.listQueue);

router.get(
  "/:id/attachments/:attachmentId/download",
  idParamValidation,
  validate,
  inboundMailQueueController.downloadAttachment
);

router.get("/:id", idParamValidation, validate, inboundMailQueueController.getQueueItem);

router.post(
  "/:id/assign",
  assignValidation,
  validate,
  inboundMailQueueController.assignToTeam
);

router.post(
  "/:id/reject",
  rejectValidation,
  validate,
  inboundMailQueueController.rejectMail
);

module.exports = router;
