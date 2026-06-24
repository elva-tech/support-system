const asyncHandler = require("../../shared/utils/asyncHandler");
const teamService = require("./team.service");

const list = asyncHandler(async (req, res) => {
  const teams = await teamService.list(req.query);
  res.json({ data: teams });
});

const getById = asyncHandler(async (req, res) => {
  const team = await teamService.getById(req.params.id);
  res.json({ data: team });
});

const create = asyncHandler(async (req, res) => {
  const team = await teamService.create(req.body);
  res.status(201).json({ message: "Team created", data: team });
});

const update = asyncHandler(async (req, res) => {
  const team = await teamService.update(req.params.id, req.body);
  res.json({ message: "Team updated", data: team });
});

const remove = asyncHandler(async (req, res) => {
  await teamService.remove(req.params.id);
  res.json({ message: "Team deleted" });
});

module.exports = { list, getById, create, update, remove };
