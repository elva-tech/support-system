const express = require("express");
const asyncHandler = require("../../shared/utils/asyncHandler");
const notificationCenterService = require("./notification-center.service");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);
router.use(authorize(ROLES.ADMIN, ROLES.TEAM_LEAD));

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const data = await notificationCenterService.getSummary();
    res.json({ data });
  })
);

router.get(
  "/deliveries",
  asyncHandler(async (req, res) => {
    const result = await notificationCenterService.listDeliveries(req.query);
    res.json(result);
  })
);

router.get(
  "/pending",
  asyncHandler(async (req, res) => {
    const result = await notificationCenterService.listPendingNotifications(req.query);
    res.json(result);
  })
);

module.exports = router;
