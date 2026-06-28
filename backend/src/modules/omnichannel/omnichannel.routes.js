const express = require("express");
const asyncHandler = require("../../shared/utils/asyncHandler");
const omnichannelEngine = require("../omnichannel/conversation-engine.service");
const emailInboundService = require("../email/email-inbound.service");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const internalApiAuth = require("../../shared/middleware/internal-api.middleware");
const { ROLES } = require("../../shared/constants/roles");
const { CONVERSATION_SOURCES } = require("../../shared/constants/communication-channels");
const { body } = require("express-validator");
const validate = require("../../shared/middleware/validate.middleware");

const router = express.Router();

const inboundValidation = [
  body("senderEmail").isEmail().normalizeEmail(),
  body("subject").trim().notEmpty(),
  body("body").optional().isString()
];

router.post(
  "/inbound",
  internalApiAuth,
  inboundValidation,
  validate,
  asyncHandler(async (req, res) => {
    const data = await omnichannelEngine.processInbound({
      ...req.body,
      source: req.body.source || CONVERSATION_SOURCES.API
    });
    res.json({ data });
  })
);

router.post(
  "/inbound/simulate",
  authenticate,
  authorize(ROLES.ADMIN),
  inboundValidation,
  validate,
  asyncHandler(async (req, res) => {
    const data = await omnichannelEngine.processInbound({
      ...req.body,
      source: req.body.source || CONVERSATION_SOURCES.API
    });
    res.json({ data });
  })
);

router.post(
  "/email/poll",
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(async (_req, res) => {
    const result = await emailInboundService.pollInbox();
    res.json({ data: result });
  })
);

module.exports = router;
