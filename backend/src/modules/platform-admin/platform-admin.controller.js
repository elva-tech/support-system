const asyncHandler = require("../../shared/utils/asyncHandler");
const platformAuthService = require("./platform-auth.service");
const platformAdminService = require("./platform-admin.service");
const platformTenantService = require("./platform-tenant.service");
const { listPlatformAudit } = require("./platform-audit.service");

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await platformAuthService.login(email, password);
  res.json({
    message: "Platform login successful",
    data: result
  });
});

const getMe = asyncHandler(async (req, res) => {
  const admin = await platformAuthService.getMe(req.platformAdmin._id);
  res.json({ data: admin });
});

const listAdmins = asyncHandler(async (req, res) => {
  const result = await platformAdminService.list(req.query);
  res.json({ data: result });
});

const createAdmin = asyncHandler(async (req, res) => {
  const admin = await platformAdminService.create(req.body, { actor: req.platformAdmin });
  res.status(201).json({
    message: "Platform admin created",
    data: admin
  });
});

const updateAdmin = asyncHandler(async (req, res) => {
  const admin = await platformAdminService.update(req.params.adminId, req.body, {
    actor: req.platformAdmin
  });
  res.json({
    message: "Platform admin updated",
    data: admin
  });
});

const createTenant = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.createTenant(req.body, {
    actor: req.platformAdmin
  });
  res.status(201).json({
    message: "Tenant created",
    data: tenant
  });
});

const listTenants = asyncHandler(async (req, res) => {
  const result = await platformTenantService.listTenants(req.query);
  res.json({ data: result });
});

const getTenant = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.getTenant(req.params.tenantId);
  res.json({ data: tenant });
});

const updateTenant = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.updateTenant(req.params.tenantId, req.body, {
    actor: req.platformAdmin
  });
  res.json({
    message: "Tenant updated",
    data: tenant
  });
});

const activateTenant = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.activateTenant(req.params.tenantId, {
    actor: req.platformAdmin
  });
  res.json({ message: "Tenant activated", data: tenant });
});

const suspendTenant = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.suspendTenant(req.params.tenantId, {
    actor: req.platformAdmin
  });
  res.json({ message: "Tenant suspended", data: tenant });
});

const cancelTenant = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.cancelTenant(req.params.tenantId, {
    actor: req.platformAdmin
  });
  res.json({ message: "Tenant cancelled", data: tenant });
});

const archiveTenant = asyncHandler(async (req, res) => {
  const tenant = await platformTenantService.archiveTenant(req.params.tenantId, {
    actor: req.platformAdmin
  });
  res.json({ message: "Tenant archived", data: tenant });
});

const listAudit = asyncHandler(async (req, res) => {
  const result = await listPlatformAudit(req.query);
  res.json({ data: result });
});

module.exports = {
  login,
  getMe,
  listAdmins,
  createAdmin,
  updateAdmin,
  createTenant,
  listTenants,
  getTenant,
  updateTenant,
  activateTenant,
  suspendTenant,
  cancelTenant,
  archiveTenant,
  listAudit
};
