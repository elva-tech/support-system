const asyncHandler = require("../../shared/utils/asyncHandler");
const teamService = require("./team.service");

const tenantCtx = (req) => ({ tenantId: req.tenant._id });

const list = asyncHandler(async (req, res) => {
  const teams = await teamService.list(req.query, tenantCtx(req));
  res.json({ data: teams });
});

const getById = asyncHandler(async (req, res) => {
  const team = await teamService.getById(req.params.id, tenantCtx(req));
  res.json({ data: team });
});

const create = asyncHandler(async (req, res) => {
  const team = await teamService.create(req.body, tenantCtx(req));
  res.status(201).json({ message: "Team created", data: team });
});

const update = asyncHandler(async (req, res) => {
  const team = await teamService.update(req.params.id, req.body, tenantCtx(req));
  res.json({ message: "Team updated", data: team });
});

const remove = asyncHandler(async (req, res) => {
  await teamService.remove(req.params.id, tenantCtx(req));
  res.json({ message: "Team deleted" });
});

module.exports = { list, getById, create, update, remove };
