const express = require("express");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { listTenantAuditLogs } = require("./audit.service");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const {
  requireTenantContext,
  requireTenantMembership
} = require("../../shared/middleware/tenant-context.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);
router.use(requireTenantContext);
router.use(requireTenantMembership);
router.use(authorize(ROLES.ADMIN));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await listTenantAuditLogs(req.query, { tenantId: req.tenant._id });
    res.json(result);
  })
);

module.exports = router;
