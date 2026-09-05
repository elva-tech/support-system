const ApiError = require("../../shared/utils/ApiError");
const User = require("../users/user.model");
const Team = require("../teams/team.model");
const Tenant = require("../tenants/tenant.model");
const StaffInvitation = require("./staff-invitation.model");
const { ROLES } = require("../../shared/constants/roles");
const {
  USER_STATUSES,
  isActiveFlagForStatus
} = require("../../shared/constants/user-lifecycle");
const { INVITATION_STATUSES } = require("../../shared/constants/provisioning");
const {
  generateInvitationToken,
  generateUnusablePassword,
  getInvitationExpiryDate,
  hashInvitationToken,
  buildInvitationUrl,
  buildWorkspaceUrl,
  assertValidPassword
} = require("../tenant-provisioning/invitation-token.util");
const { withTenantFilter, stripClientTenantId } = require("../../shared/utils/tenant-scope.util");
const onboardingEmail = require("../notifications/onboarding-email.service");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");

const populateOptions = [
  { path: "teamId", select: "name" },
  { path: "applicationIds", select: "name code" }
];

const actorNameFromId = async (userId) => {
  if (!userId) return "Admin";
  const actor = await User.findById(userId).select("firstName lastName");
  return actor ? `${actor.firstName} ${actor.lastName}` : "Admin";
};

const logStaffAudit = async ({
  action,
  user,
  tenantId,
  actorUserId,
  metadata = {}
}) => {
  await logAudit({
    entityType: ENTITY_TYPES.USER,
    entityId: user._id,
    action,
    actorType: ACTOR_TYPES.AGENT,
    actorId: actorUserId || null,
    actorName: await actorNameFromId(actorUserId),
    tenantId,
    metadata: {
      email: user.email,
      role: user.role,
      ...metadata
    },
    skipNotificationEvent: true
  });
};

const deriveApplicationIdsFromTeam = async (teamId, { tenantId } = {}) => {
  const team = await Team.findOne(withTenantFilter(tenantId, { _id: teamId })).select("applicationId");
  if (!team) {
    throw new ApiError(400, "Team not found");
  }
  return [team.applicationId];
};

const applyStaffTeamAssignment = async (data, { tenantId } = {}) => {
  if (data.role === ROLES.ADMIN) {
    data.teamId = null;
    data.applicationIds = [];
    return;
  }

  if (!data.teamId) {
    throw new ApiError(400, "Please select an application and team");
  }

  data.applicationIds = await deriveApplicationIdsFromTeam(data.teamId, { tenantId });
};

const syncTeamMembership = async (userId, teamId, previousTeamId = null, role = null, { tenantId } = {}) => {
  if (role === ROLES.ADMIN) {
    if (previousTeamId) {
      await Team.findOneAndUpdate(
        withTenantFilter(tenantId, { _id: previousTeamId }),
        { $pull: { memberIds: userId } }
      );
    }
    return;
  }

  if (previousTeamId && previousTeamId.toString() !== teamId?.toString()) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: previousTeamId }),
      { $pull: { memberIds: userId } }
    );
  }

  if (teamId) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: teamId }),
      { $addToSet: { memberIds: userId } }
    );
  }
};

const syncTeamLeadRole = async (user, { previousTeamId = null, previousRole = null, tenantId } = {}) => {
  if (user.role === ROLES.ADMIN) {
    return;
  }

  const userId = user._id;
  const teamId = user.teamId?.toString();
  const prevTeamId = previousTeamId?.toString();

  if (prevTeamId && prevTeamId !== teamId) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: prevTeamId, teamLeadId: userId }),
      { $set: { teamLeadId: null } }
    );
  }

  if (previousRole === ROLES.TEAM_LEAD && user.role !== ROLES.TEAM_LEAD && teamId) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: teamId, teamLeadId: userId }),
      { $set: { teamLeadId: null } }
    );
  }

  if (user.role === ROLES.TEAM_LEAD && teamId) {
    await Team.findOneAndUpdate(
      withTenantFilter(tenantId, { _id: teamId }),
      {
        $set: { teamLeadId: userId },
        $addToSet: { memberIds: userId }
      }
    );
  }
};

const revokePendingInvitationsForUser = async (userId, { tenantId } = {}) => {
  await StaffInvitation.updateMany(
    withTenantFilter(tenantId, {
      userId,
      status: INVITATION_STATUSES.PENDING
    }),
    {
      $set: {
        status: INVITATION_STATUSES.REVOKED,
        revokedAt: new Date()
      }
    }
  );
};

const createInvitationRecord = async ({
  tenantId,
  user,
  createdByUserId,
  rawToken,
  tokenHash
}) => {
  await revokePendingInvitationsForUser(user._id, { tenantId });

  return StaffInvitation.create({
    tenantId,
    userId: user._id,
    email: user.email,
    role: user.role,
    teamId: user.teamId || null,
    tokenHash,
    status: INVITATION_STATUSES.PENDING,
    expiresAt: getInvitationExpiryDate(),
    createdByUserId
  });
};

const sendStaffInviteEmail = async ({ tenant, user, rawToken }) => {
  const invitationUrl = buildInvitationUrl(tenant.slug, rawToken);
  const workspaceUrl = buildWorkspaceUrl(tenant.slug);

  const result = await onboardingEmail.sendStaffInvitationEmail({
    user,
    tenant,
    invitationUrl,
    workspaceUrl,
    expiryHours: env.tenantProvisioning.invitationExpiryHours
  });

  if (!result.success) {
    logger.warn("Staff invitation email delivery failed", {
      userId: String(user._id),
      tenantId: String(tenant._id),
      error: result.error
    });
  }

  return result;
};

/**
 * Invite a staff member — no admin-known password.
 */
const inviteStaff = async (data, { tenantId, createdByUserId } = {}) => {
  if (!tenantId) {
    throw new ApiError(400, "Tenant context is required");
  }
  if (!createdByUserId) {
    throw new ApiError(400, "Inviter is required");
  }

  const payload = stripClientTenantId(data);
  delete payload.password;
  delete payload.isActive;
  delete payload.status;

  const email = String(payload.email || "")
    .toLowerCase()
    .trim();
  if (!email) {
    throw new ApiError(400, "Valid email is required");
  }

  const existing = await User.findOne({ email, tenantId });
  if (existing) {
    throw new ApiError(409, "Email already exists");
  }

  await applyStaffTeamAssignment(payload, { tenantId });

  if (payload.teamId) {
    const team = await Team.findOne(withTenantFilter(tenantId, { _id: payload.teamId }));
    if (!team) {
      throw new ApiError(400, "Team not found");
    }
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, "Tenant not found");
  }

  const { rawToken, tokenHash } = generateInvitationToken();

  const user = await User.create({
    tenantId,
    email,
    password: generateUnusablePassword(),
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload.role,
    teamId: payload.teamId || null,
    applicationIds: payload.applicationIds || [],
    status: USER_STATUSES.INVITED,
    isActive: false
  });

  await syncTeamMembership(user._id, user.teamId, null, user.role, { tenantId });
  await syncTeamLeadRole(user, { tenantId });

  await createInvitationRecord({
    tenantId,
    user,
    createdByUserId,
    rawToken,
    tokenHash
  });

  await sendStaffInviteEmail({ tenant, user, rawToken });

  await logStaffAudit({
    action: AUDIT_ACTIONS.USER_INVITED,
    user,
    tenantId,
    actorUserId: createdByUserId
  });

  // Never return raw token
  return User.findOne(withTenantFilter(tenantId, { _id: user._id })).populate(populateOptions);
};

const resendInvitation = async (userId, { tenantId, createdByUserId } = {}) => {
  const user = await User.findOne(withTenantFilter(tenantId, { _id: userId }));
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== USER_STATUSES.INVITED && user.isActive) {
    throw new ApiError(400, "User is already active; invitation cannot be resent");
  }

  if (user.status !== USER_STATUSES.INVITED) {
    throw new ApiError(400, "Only invited users can receive a resent invitation");
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, "Tenant not found");
  }

  const { rawToken, tokenHash } = generateInvitationToken();
  await createInvitationRecord({
    tenantId,
    user,
    createdByUserId,
    rawToken,
    tokenHash
  });

  await sendStaffInviteEmail({ tenant, user, rawToken });

  await logStaffAudit({
    action: AUDIT_ACTIONS.USER_INVITATION_RESENT,
    user,
    tenantId,
    actorUserId: createdByUserId
  });

  return User.findOne(withTenantFilter(tenantId, { _id: userId })).populate(populateOptions);
};

const revokeInvitation = async (userId, { tenantId, createdByUserId, actorUserId } = {}) => {
  const user = await User.findOne(withTenantFilter(tenantId, { _id: userId }));
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  await revokePendingInvitationsForUser(userId, { tenantId });

  if (user.status === USER_STATUSES.INVITED) {
    user.status = USER_STATUSES.DEACTIVATED;
    user.isActive = false;
    await user.save();
  }

  await logStaffAudit({
    action: AUDIT_ACTIONS.USER_INVITATION_REVOKED,
    user,
    tenantId,
    actorUserId: createdByUserId || actorUserId
  });

  return User.findOne(withTenantFilter(tenantId, { _id: userId })).populate(populateOptions);
};

const setLifecycleStatus = async (userId, nextStatus, { tenantId, actorUserId } = {}) => {
  const user = await User.findOne(withTenantFilter(tenantId, { _id: userId }));
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (actorUserId && String(user._id) === String(actorUserId)) {
    throw new ApiError(400, "Cannot change your own lifecycle status");
  }

  if (nextStatus === USER_STATUSES.ACTIVE && user.status === USER_STATUSES.INVITED) {
    throw new ApiError(400, "Invited users must complete account setup to become active");
  }

  const previousStatus = user.status;
  user.status = nextStatus;
  user.isActive = isActiveFlagForStatus(nextStatus);
  await user.save();

  const action =
    nextStatus === USER_STATUSES.SUSPENDED
      ? AUDIT_ACTIONS.USER_SUSPENDED
      : nextStatus === USER_STATUSES.DEACTIVATED
        ? AUDIT_ACTIONS.USER_DEACTIVATED
        : AUDIT_ACTIONS.USER_REACTIVATED;

  await logStaffAudit({
    action,
    user,
    tenantId,
    actorUserId,
    metadata: { previousStatus, nextStatus }
  });

  return User.findOne(withTenantFilter(tenantId, { _id: userId })).populate(populateOptions);
};

const suspendUser = (userId, ctx) => setLifecycleStatus(userId, USER_STATUSES.SUSPENDED, ctx);
const deactivateUser = (userId, ctx) => setLifecycleStatus(userId, USER_STATUSES.DEACTIVATED, ctx);
const reactivateUser = (userId, ctx) => setLifecycleStatus(userId, USER_STATUSES.ACTIVE, ctx);

/**
 * Public: validate staff invitation token (generic invalid responses).
 */
const validateStaffInvitationToken = async (rawToken) => {
  if (!rawToken || String(rawToken).length < 16) {
    return { valid: false };
  }

  const tokenHash = hashInvitationToken(rawToken);
  const invitation = await StaffInvitation.findOne({ tokenHash }).select("+tokenHash");

  if (!invitation || invitation.status !== INVITATION_STATUSES.PENDING) {
    return { valid: false };
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    invitation.status = INVITATION_STATUSES.EXPIRED;
    await invitation.save();
    return { valid: false };
  }

  const tenant = await Tenant.findById(invitation.tenantId);
  const user = await User.findById(invitation.userId);
  if (!tenant || !user || user.status === USER_STATUSES.ACTIVE || user.isActive) {
    return { valid: false };
  }

  const { publicBrandingPayload } = require("../workspace/workspace.service");
  const branding = publicBrandingPayload(tenant);

  return {
    valid: true,
    invitationType: "STAFF",
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    adminName: `${user.firstName} ${user.lastName}`.replace(/ -$/, "").trim(),
    adminEmail: user.email,
    role: user.role,
    expiresAt: invitation.expiresAt,
    branding: {
      organizationName: branding.organizationName,
      supportDisplayName: branding.supportDisplayName,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      loginTitle: branding.loginTitle,
      loginSubtitle: branding.loginSubtitle,
      customerLabel: branding.customerLabel,
      logoAvailable: branding.logoAvailable
    }
  };
};

/**
 * Public: complete staff account setup.
 */
const completeStaffAccountSetup = async ({ token, password, confirmPassword }) => {
  assertValidPassword(password);
  if (confirmPassword !== undefined && confirmPassword !== password) {
    throw new ApiError(400, "Passwords do not match");
  }

  if (!token || String(token).length < 16) {
    throw new ApiError(400, "Invalid or expired invitation", { code: "INVALID_INVITATION" });
  }

  const tokenHash = hashInvitationToken(token);
  const invitation = await StaffInvitation.findOne({ tokenHash }).select("+tokenHash");

  if (!invitation) {
    throw new ApiError(400, "Invalid or expired invitation", { code: "INVALID_INVITATION" });
  }

  if (invitation.status === INVITATION_STATUSES.ACCEPTED) {
    throw new ApiError(400, "Invitation has already been used", { code: "INVITATION_ALREADY_USED" });
  }

  if (invitation.status === INVITATION_STATUSES.REVOKED) {
    throw new ApiError(400, "Invalid or expired invitation", { code: "INVALID_INVITATION" });
  }

  if (
    invitation.status === INVITATION_STATUSES.EXPIRED ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    invitation.status = INVITATION_STATUSES.EXPIRED;
    await invitation.save();
    throw new ApiError(400, "Invitation has expired", { code: "INVITATION_EXPIRED" });
  }

  if (invitation.status !== INVITATION_STATUSES.PENDING) {
    throw new ApiError(400, "Invalid or expired invitation", { code: "INVALID_INVITATION" });
  }

  const user = await User.findById(invitation.userId).select("+password");
  if (!user || user.status === USER_STATUSES.ACTIVE || user.isActive) {
    throw new ApiError(400, "Invalid or expired invitation", { code: "INVALID_INVITATION" });
  }

  user.password = password;
  user.status = USER_STATUSES.ACTIVE;
  user.isActive = true;
  await user.save();

  invitation.status = INVITATION_STATUSES.ACCEPTED;
  invitation.acceptedAt = new Date();
  invitation.tokenHash = hashInvitationToken(`${token}:accepted:${invitation._id}`);
  await invitation.save();

  const tenant = await Tenant.findById(invitation.tenantId);

  return {
    success: true,
    tenantSlug: tenant?.slug || null,
    email: user.email
  };
};

module.exports = {
  inviteStaff,
  resendInvitation,
  revokeInvitation,
  suspendUser,
  deactivateUser,
  reactivateUser,
  validateStaffInvitationToken,
  completeStaffAccountSetup,
  hashInvitationToken,
  generateInvitationToken
};
