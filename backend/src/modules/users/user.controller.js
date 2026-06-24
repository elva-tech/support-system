const asyncHandler = require("../../shared/utils/asyncHandler");
const userService = require("./user.service");

const list = asyncHandler(async (req, res) => {
  const users = await userService.list(req.query);
  res.json({ data: users });
});

const getById = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id);
  res.json({ data: user });
});

const create = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  res.status(201).json({ message: "User created", data: user });
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  res.json({ message: "User updated", data: user });
});

const remove = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id, req.user._id);
  res.json({ message: "User deleted" });
});

module.exports = { list, getById, create, update, remove };
