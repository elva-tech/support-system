const express = require("express");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { listTenantAuditLogs, getTenantAuditLogById } = require("./audit.service");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const {
  requireTenantContext,
  requireTenantMembership
} = require("../../shared/middleware/tenant-context.middleware");
const { ROLES } = require("../../shared/constants/roles");
const { param } = require("express-validator");
const validate = require("../../shared/middleware/validate.middleware");

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

router.get(
  "/:id",
  param("id").isMongoId().withMessage("Invalid audit id"),
  validate,
  asyncHandler(async (req, res) => {
    const data = await getTenantAuditLogById(req.params.id, { tenantId: req.tenant._id });
    res.json({ data });
  })
);

module.exports = router;
