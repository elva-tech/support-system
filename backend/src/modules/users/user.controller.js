const asyncHandler = require("../../shared/utils/asyncHandler");
const userService = require("./user.service");

const tenantCtx = (req) => ({
  tenantId: req.tenant._id,
  createdByUserId: req.user._id,
  actorUserId: req.user._id
});

const list = asyncHandler(async (req, res) => {
  const users = await userService.list(req.query, tenantCtx(req));
  res.json({ data: users });
});

const getById = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.params.id, tenantCtx(req));
  res.json({ data: user });
});

const create = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body, tenantCtx(req));
  res.status(201).json({ message: "User invited", data: user });
});

const invite = asyncHandler(async (req, res) => {
  const user = await userService.inviteStaff(req.body, tenantCtx(req));
  res.status(201).json({ message: "User invited", data: user });
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.update(req.params.id, req.body, tenantCtx(req));
  res.json({ message: "User updated", data: user });
});

const remove = asyncHandler(async (req, res) => {
  await userService.remove(req.params.id, req.user._id, tenantCtx(req));
  res.json({ message: "User deleted" });
});

const resendInvitation = asyncHandler(async (req, res) => {
  const user = await userService.resendInvitation(req.params.id, tenantCtx(req));
  res.json({ message: "Invitation resent", data: user });
});

const revokeInvitation = asyncHandler(async (req, res) => {
  const user = await userService.revokeInvitation(req.params.id, tenantCtx(req));
  res.json({ message: "Invitation revoked", data: user });
});

const suspend = asyncHandler(async (req, res) => {
  const user = await userService.suspendUser(req.params.id, tenantCtx(req));
  res.json({ message: "User suspended", data: user });
});

const reactivate = asyncHandler(async (req, res) => {
  const user = await userService.reactivateUser(req.params.id, tenantCtx(req));
  res.json({ message: "User reactivated", data: user });
});

const deactivate = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.params.id, tenantCtx(req));
  res.json({ message: "User deactivated", data: user });
});

module.exports = {
  list,
  getById,
  create,
  invite,
  update,
  remove,
  resendInvitation,
  revokeInvitation,
  suspend,
  reactivate,
  deactivate
};
