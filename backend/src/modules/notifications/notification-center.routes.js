const express = require("express");
const asyncHandler = require("../../shared/utils/asyncHandler");
const notificationCenterService = require("./notification-center.service");
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
router.use(authorize(ROLES.ADMIN, ROLES.TEAM_LEAD));

const tenantCtx = (req) => ({ tenantId: req.tenant._id });

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const data = await notificationCenterService.getSummary(tenantCtx(req));
    res.json({ data });
  })
);

router.get(
  "/deliveries",
  asyncHandler(async (req, res) => {
    const result = await notificationCenterService.listDeliveries(req.query, tenantCtx(req));
    res.json(result);
  })
);

router.get(
  "/pending",
  asyncHandler(async (req, res) => {
    const result = await notificationCenterService.listPendingNotifications(
      req.query,
      tenantCtx(req)
    );
    res.json(result);
  })
);

module.exports = router;
