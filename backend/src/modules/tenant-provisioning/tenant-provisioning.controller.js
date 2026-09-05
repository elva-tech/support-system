const asyncHandler = require("../../shared/utils/asyncHandler");
const provisioningService = require("./tenant-provisioning.service");
const staffInvitationService = require("../staff-invitations/staff-invitation.service");
const TenantAdminInvitation = require("./tenant-admin-invitation.model");
const StaffInvitation = require("../staff-invitations/staff-invitation.model");
const { hashInvitationToken } = require("./invitation-token.util");

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

const checkSlugAvailability = asyncHandler(async (req, res) => {
  const workspaceDomain = require("../tenants/workspace-domain.service");
  const data = await workspaceDomain.checkWorkspaceAvailability(req.query.slug || req.body?.slug);
  const status = data.available ? 200 : 409;
  res.status(status).json({
    message: data.message,
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

/**
 * Public: validate invitation — tenant-admin (Phase 6) or staff (Phase 10).
 * Never reveals which email/token type failed.
 */
const getInvitation = asyncHandler(async (req, res) => {
  const { SECURITY_EVENTS, logSecurityEvent } = require("../../shared/observability/security-events");
  const adminInvite = await provisioningService.validateInvitationToken(req.params.token);
  if (adminInvite.valid) {
    return res.json({ data: adminInvite });
  }

  const staffInvite = await staffInvitationService.validateStaffInvitationToken(req.params.token);
  if (!staffInvite?.valid) {
    logSecurityEvent(SECURITY_EVENTS.INVITATION_TOKEN_INVALID, req, {
      reason: "validation_failed"
    });
  }
  res.json({ data: staffInvite });
});

/**
 * Public: complete setup for either invitation type (route by hashed token ownership).
 */
const completeSetup = asyncHandler(async (req, res) => {
  const rawToken = req.body?.token;
  if (rawToken && String(rawToken).length >= 16) {
    const tokenHash = hashInvitationToken(rawToken);
    const staffInvite = await StaffInvitation.findOne({ tokenHash }).select("_id");
    if (staffInvite) {
      const data = await staffInvitationService.completeStaffAccountSetup(req.body);
      return res.json({
        message: "Account setup complete. You can now sign in.",
        data
      });
    }

    const adminInvite = await TenantAdminInvitation.findOne({ tokenHash }).select("_id");
    if (adminInvite) {
      const data = await provisioningService.completeAccountSetup(req.body);
      return res.json({
        message: "Account setup complete. You can now sign in.",
        data
      });
    }
  }

  // Generic failure path (no token leak)
  const data = await provisioningService.completeAccountSetup(req.body);
  res.json({
    message: "Account setup complete. You can now sign in.",
    data
  });
});

module.exports = {
  provisionTenant,
  checkSlugAvailability,
  listProvisionings,
  getProvisioning,
  retryProvisioning,
  resendInvitation,
  getInvitation,
  completeSetup
};
