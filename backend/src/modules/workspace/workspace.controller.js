const asyncHandler = require("../../shared/utils/asyncHandler");
const workspaceService = require("./workspace.service");

const actorCtx = (req) => ({ actor: req.user });

const getSettings = asyncHandler(async (req, res) => {
  const data = await workspaceService.getSettings(req.tenant._id);
  res.json({ data });
});

const getSetupStatus = asyncHandler(async (req, res) => {
  const data = await workspaceService.getSetupStatus(req.tenant._id);
  res.json({ data });
});

const getPublicBranding = asyncHandler(async (req, res) => {
  const data = await workspaceService.getPublicBranding(req.tenant._id);
  res.json({ data });
});

const updateOrganization = asyncHandler(async (req, res) => {
  const data = await workspaceService.updateOrganization(req.tenant._id, req.body, actorCtx(req));
  res.json({ message: "Organization settings updated", data });
});

const updateBranding = asyncHandler(async (req, res) => {
  const data = await workspaceService.updateBranding(req.tenant._id, req.body, actorCtx(req));
  res.json({ message: "Branding updated", data });
});

const updateSupport = asyncHandler(async (req, res) => {
  const data = await workspaceService.updateSupportSettings(req.tenant._id, req.body, actorCtx(req));
  res.json({ message: "Support settings updated", data });
});

const skipStep = asyncHandler(async (req, res) => {
  const data = await workspaceService.skipSetupStep(req.tenant._id, req.params.step, actorCtx(req));
  res.json({ message: "Setup step skipped", data });
});

const uploadLogo = asyncHandler(async (req, res) => {
  const data = await workspaceService.uploadLogo(req.tenant._id, req.file, actorCtx(req));
  res.status(201).json({ message: "Logo uploaded", data });
});

const deleteLogo = asyncHandler(async (req, res) => {
  const data = await workspaceService.deleteLogo(req.tenant._id, actorCtx(req));
  res.json({ message: "Logo removed", data });
});

const streamLogo = asyncHandler(async (req, res) => {
  const file = await workspaceService.getLogoFile(req.tenant._id);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
  res.send(file.buffer);
});

const getServiceManagement = asyncHandler(async (req, res) => {
  const data = await workspaceService.getServiceManagementSettings(req.tenant._id);
  res.json({ data });
});

const updateServiceManagement = asyncHandler(async (req, res) => {
  const data = await workspaceService.updateServiceManagementSettings(
    req.tenant._id,
    req.body,
    actorCtx(req)
  );
  res.json({ message: "Service management settings updated", data });
});

module.exports = {
  getSettings,
  getSetupStatus,
  getPublicBranding,
  updateOrganization,
  updateBranding,
  updateSupport,
  getServiceManagement,
  updateServiceManagement,
  skipStep,
  uploadLogo,
  deleteLogo,
  streamLogo
};
