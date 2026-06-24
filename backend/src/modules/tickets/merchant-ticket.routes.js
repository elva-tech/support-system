const express = require("express");
const merchantTicketController = require("./merchant-ticket.controller");
const merchantCommController = require("./merchant-ticket-communication.controller");
const { createTicketValidation } = require("./ticket.validation");
const {
  replyValidation,
  ticketIdParamValidation
} = require("../conversations/conversation.validation");
const validate = require("../../shared/middleware/validate.middleware");
const merchantAuthenticate = require("../../shared/middleware/merchant-auth.middleware");
const { handleUpload } = require("../../shared/middleware/upload.middleware");

const router = express.Router();

router.use(merchantAuthenticate);

router.get("/modules", merchantTicketController.listModules);
router.get("/stats", merchantTicketController.getStats);
router.get("/", merchantTicketController.list);
router.post("/", createTicketValidation, validate, merchantTicketController.create);

router.post("/:id/reply", replyValidation, validate, merchantCommController.merchantReply);
router.get("/:id/timeline", ticketIdParamValidation, validate, merchantCommController.merchantTimeline);
router.post("/:id/attachments", ticketIdParamValidation, validate, handleUpload, merchantCommController.merchantUpload);

router.get("/:id", ticketIdParamValidation, validate, merchantTicketController.getById);

module.exports = router;
