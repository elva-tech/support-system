const express = require("express");
const dashboardController = require("./dashboard.controller");
const authenticate = require("../../shared/middleware/auth.middleware");
const authorize = require("../../shared/middleware/role.middleware");
const { ROLES } = require("../../shared/constants/roles");

const router = express.Router();

router.use(authenticate);

router.get("/agent", dashboardController.getAgentMetrics);
router.get(
  "/team-workload",
  authorize(ROLES.ADMIN, ROLES.TEAM_LEAD),
  dashboardController.getTeamWorkload
);

module.exports = router;
