const express = require("express");
const attachmentController = require("./attachment.controller");
const flexibleAuth = require("../../shared/middleware/flexible-auth.middleware");

const router = express.Router();

router.get("/:id/download", flexibleAuth, attachmentController.download);

module.exports = router;
