const asyncHandler = require("../../shared/utils/asyncHandler");
const moduleService = require("./module.service");

const tenantCtx = (req) => ({ tenantId: req.tenant._id });

const list = asyncHandler(async (req, res) => {
  const modules = await moduleService.list(req.query, tenantCtx(req));
  res.json({ data: modules });
});

const getById = asyncHandler(async (req, res) => {
  const moduleDoc = await moduleService.getById(req.params.id, tenantCtx(req));
  res.json({ data: moduleDoc });
});

const create = asyncHandler(async (req, res) => {
  const moduleDoc = await moduleService.create(req.body, tenantCtx(req));
  res.status(201).json({ message: "Module created", data: moduleDoc });
});

const update = asyncHandler(async (req, res) => {
  const moduleDoc = await moduleService.update(req.params.id, req.body, tenantCtx(req));
  res.json({ message: "Module updated", data: moduleDoc });
});

const remove = asyncHandler(async (req, res) => {
  await moduleService.remove(req.params.id, tenantCtx(req));
  res.json({ message: "Module deleted" });
});

module.exports = { list, getById, create, update, remove };
