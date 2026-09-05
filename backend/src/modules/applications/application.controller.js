const asyncHandler = require("../../shared/utils/asyncHandler");
const applicationService = require("./application.service");

const tenantCtx = (req) => ({ tenantId: req.tenant._id, actor: req.user });

const list = asyncHandler(async (req, res) => {
  const applications = await applicationService.list(req.query, tenantCtx(req));
  res.json({ data: applications });
});

const getById = asyncHandler(async (req, res) => {
  const application = await applicationService.getById(req.params.id, tenantCtx(req));
  res.json({ data: application });
});

const create = asyncHandler(async (req, res) => {
  const application = await applicationService.create(req.body, tenantCtx(req));
  res.status(201).json({ message: "Application created", data: application });
});

const update = asyncHandler(async (req, res) => {
  const application = await applicationService.update(req.params.id, req.body, tenantCtx(req));
  res.json({ message: "Application updated", data: application });
});

const remove = asyncHandler(async (req, res) => {
  await applicationService.remove(req.params.id, tenantCtx(req));
  res.json({ message: "Application deleted" });
});

module.exports = { list, getById, create, update, remove };
