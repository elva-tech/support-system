const express = require("express");
const internalController = require("./internal.controller");
const { syncMerchantValidation } = require("./merchant.validation");
const validate = require("../../shared/middleware/validate.middleware");
const internalApiAuth = require("../../shared/middleware/internal-api.middleware");

const router = express.Router();

router.use(internalApiAuth);

router.post("/merchants/sync", syncMerchantValidation, validate, internalController.syncMerchant);

module.exports = router;
