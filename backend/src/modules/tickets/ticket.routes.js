const express = require("express");
const ticketController = require("./ticket.controller");
const commController = require("./ticket-communication.controller");
const {
  replyValidation,
  internalNoteValidation,
  statusValidation,
  transferValidation,
  ticketIdParamValidation
} = require("../conversations/conversation.validation");
const { assignValidation } = require("./ticket.validation");
const validate = require("../../shared/middleware/validate.middleware");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const requireTicketAccess = require("../../shared/middleware/require-ticket-access.middleware");
const { handleUpload } = require("../../shared/middleware/upload.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);

router.get("/my", ticketController.listMy);
router.get("/team", ticketController.listTeam);
router.get("/", ticketController.list);

router.patch(
  "/:id/assign",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  assignValidation,
  validate,
  ticketController.assign
);
router.get(
  "/:id/assignable-agents",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  ticketIdParamValidation,
  validate,
  ticketController.getTeamAgents
);

router.post("/:id/reply", requireTicketAccess, replyValidation, validate, commController.reply);
router.post("/:id/internal-note", requireTicketAccess, internalNoteValidation, validate, commController.internalNote);
router.patch("/:id/status", requireTicketAccess, statusValidation, validate, commController.updateStatus);
router.patch("/:id/transfer", requireTicketAccess, transferValidation, validate, commController.transfer);
router.get("/:id/timeline", requireTicketAccess, ticketIdParamValidation, validate, commController.timeline);
router.post(
  "/:id/attachments",
  requireTicketAccess,
  ticketIdParamValidation,
  validate,
  handleUpload,
  commController.upload
);

router.get("/:id", requireTicketAccess, ticketIdParamValidation, validate, ticketController.getById);

module.exports = router;
