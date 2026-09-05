const asyncHandler = require("../../shared/utils/asyncHandler");
const provisioningService = require("./tenant-provisioning.service");

const provisionTenant = asyncHandler(async (req, res) => {
  const data = await provisioningService.provisionTenant(req.body, {
    actor: req.platformAdmin
  });

  const statusCode = data.status === "FAILED" ? 422 : 201;
  res.status(statusCode).json({
    message:
      data.status === "FAILED"
        ? "Tenant provisioning failed"
        : "Tenant provisioning completed",
    data
  });
});

const listProvisionings = asyncHandler(async (req, res) => {
  const data = await provisioningService.listProvisionings(req.query);
  res.json({ data });
});

const getProvisioning = asyncHandler(async (req, res) => {
  const data = await provisioningService.getProvisioning(req.params.provisioningId);
  res.json({ data });
});

const retryProvisioning = asyncHandler(async (req, res) => {
  const data = await provisioningService.retryProvisioning(req.params.provisioningId, {
    actor: req.platformAdmin
  });
  res.json({ message: "Provisioning retry completed", data });
});

const resendInvitation = asyncHandler(async (req, res) => {
  const data = await provisioningService.resendInvitation(req.params.provisioningId, {
    actor: req.platformAdmin
  });
  res.json({ message: "Invitation resent", data });
});

const getInvitation = asyncHandler(async (req, res) => {
  const data = await provisioningService.validateInvitationToken(req.params.token);
  res.json({ data });
});

const completeSetup = asyncHandler(async (req, res) => {
  const data = await provisioningService.completeAccountSetup(req.body);
  res.json({
    message: "Account setup complete. You can now sign in.",
    data
  });
});

module.exports = {
  provisionTenant,
  listProvisionings,
  getProvisioning,
  retryProvisioning,
  resendInvitation,
  getInvitation,
  completeSetup
};
