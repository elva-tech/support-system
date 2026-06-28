const asyncHandler = require("../../shared/utils/asyncHandler");
const dashboardService = require("./dashboard.service");

const getAgentMetrics = asyncHandler(async (req, res) => {
  const metrics = await dashboardService.getAgentMetrics(req.user);
  res.json({ data: metrics });
});

const getTeamWorkload = asyncHandler(async (req, res) => {
  const workload = await dashboardService.getTeamWorkload(req.user, req.query.teamId);
  res.json({ data: workload });
});

const getOmnichannelWidgets = asyncHandler(async (req, res) => {
  const widgets = await dashboardService.getOmnichannelWidgets();
  res.json({ data: widgets });
});

module.exports = { getAgentMetrics, getTeamWorkload, getOmnichannelWidgets };
