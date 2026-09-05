const express = require("express");
const attachmentController = require("./attachment.controller");
const flexibleAuth = require("../../shared/middleware/flexible-auth.middleware");
const {
  requireTenantContext,
  requireTenantMembership,
  requireMerchantTenantMembership
} = require("../../shared/middleware/tenant-context.middleware");
const { tenantAccessDenied } = require("../tenants/tenant.errors");

const router = express.Router();

const requireAttachmentTenantMembership = (req, _res, next) => {
  if (req.merchant) {
    return requireMerchantTenantMembership(req, _res, next);
  }
  if (req.user) {
    return requireTenantMembership(req, _res, next);
  }
  return next(tenantAccessDenied());
};

router.get(
  "/:id/download",
  flexibleAuth,
  requireTenantContext,
  requireAttachmentTenantMembership,
  attachmentController.download
);

module.exports = router;
