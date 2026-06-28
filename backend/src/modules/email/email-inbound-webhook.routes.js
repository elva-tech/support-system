const express = require("express");
const { verifyInboundWebhookSecret } = require("./inbound-webhook-auth.middleware");
const { receiveInboundEmail } = require("./email-inbound-webhook.controller");

const router = express.Router();

router.post("/", verifyInboundWebhookSecret, receiveInboundEmail);

module.exports = router;
