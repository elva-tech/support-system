const Tenant = require("../tenants/tenant.model");
const TenantProvisioning = require("./tenant-provisioning.model");
const TenantAdminInvitation = require("./tenant-admin-invitation.model");
const User = require("../users/user.model");
const tenantService = require("../tenants/tenant.service");
const { ROLES } = require("../../shared/constants/roles");
const {
  PROVISIONING_STATUSES,
  PROVISIONING_STEP_KEYS,
  PROVISIONING_STEP_STATUSES,
  INVITATION_STATUSES,
  defaultProvisioningSteps
} = require("../../shared/constants/provisioning");
const {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../../shared/constants/platform");
const { logPlatformAudit } = require("../platform-admin/platform-audit.service");
const {
  generateInvitationToken,
  generateUnusablePassword,
  getInvitationExpiryDate,
  buildWorkspaceUrl,
  buildInvitationUrl,
  splitAdminName,
  hashInvitationToken,
  assertValidPassword
} = require("./invitation-token.util");
const { sendTenantAdminInvitationEmail } = require("./provisioning-email.service");
const {
  provisioningNotFound,
  provisioningConflict,
  provisioningNotRetriable,
  invalidInvitation,
  invitationExpired,
  invitationAlreadyUsed,
  tenantAdminEmailExists
} = require("./tenant-provisioning.errors");
const env = require("../../config/env");
const logger = require("../../shared/utils/logger");

const sanitizeProvisioningError = (error) => {
  if (error == null) return null;
  if (typeof error === "string") {
    return {
      message: error.slice(0, 500),
      code: "PROVISIONING_FAILED",
      technicalDetails: null,
      failedAt: new Date().toISOString(),
      retryable: true
    };
  }
  if (typeof error === "object" && error.message && !error.stack && error.code) {
    return {
      message: String(error.message).slice(0, 500),
      code: String(error.code || "PROVISIONING_FAILED"),
      technicalDetails: error.technicalDetails ? String(error.technicalDetails).slice(0, 300) : null,
      failedAt: error.failedAt || new Date().toISOString(),
      retryable: error.retryable !== false
    };
  }
  const rawCode = error?.errors?.code ?? error?.code;
  const code =
    rawCode === 11000 || rawCode === "11000"
      ? "UNIQUE_CONSTRAINT_VIOLATION"
      : rawCode
        ? String(rawCode)
        : "PROVISIONING_FAILED";
  const message = String(error?.message || error || "Provisioning step failed").slice(0, 500);
  return {
    message,
    code,
    technicalDetails: code !== "PROVISIONING_FAILED" ? code : null,
    failedAt: new Date().toISOString(),
    retryable: true
  };
};

const markStep = (provisioning, stepKey, status, error = null) => {
  if (!provisioning.steps) {
    provisioning.steps = defaultProvisioningSteps();
  }
  const step = provisioning.steps[stepKey] || {};
  step.status = status;
  step.error =
    status === PROVISIONING_STEP_STATUSES.FAILED ? sanitizeProvisioningError(error) : null;
  step.completedAt = status === PROVISIONING_STEP_STATUSES.COMPLETED ? new Date() : step.completedAt;
  if (status === PROVISIONING_STEP_STATUSES.PENDING) {
    step.completedAt = null;
  }
  provisioning.steps[stepKey] = step;
  provisioning.markModified("steps");
};

const isStepComplete = (provisioning, stepKey) =>
  provisioning.steps?.[stepKey]?.status === PROVISIONING_STEP_STATUSES.COMPLETED;

const toPublicProvisioning = (doc) => {
  if (!doc) {
    return null;
  }
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  return {
    id: String(obj._id),
    tenantId: obj.tenantId ? String(obj.tenantId) : null,
    tenantSlug: obj.tenantSlug,
    tenantName: obj.tenantName,
    tenantAdminUserId: obj.tenantAdminUserId ? String(obj.tenantAdminUserId) : null,
    tenantAdminName: obj.tenantAdminName,
    tenantAdminEmail: obj.tenantAdminEmail,
    workspaceUrl: obj.workspaceUrl,
    status: obj.status,
    steps: obj.steps,
    failure: obj.failure?.message
      ? {
          code: obj.failure.code,
          message: obj.failure.message,
          atStep: obj.failure.atStep,
          at: obj.failure.at
        }
      : null,
    completedAt: obj.completedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    requestedByPlatformAdminId: obj.requestedByPlatformAdminId
      ? String(obj.requestedByPlatformAdminId)
      : null
  };
};

const recordFailure = async (provisioning, atStep, error) => {
  const details = sanitizeProvisioningError(error);
  markStep(provisioning, atStep, PROVISIONING_STEP_STATUSES.FAILED, details);
  provisioning.status = PROVISIONING_STATUSES.FAILED;
  provisioning.failure = {
    code: details?.code || "PROVISIONING_FAILED",
    message: details?.message || String(error),
    atStep,
    at: new Date()
  };
  await provisioning.save();
};

const createInvitationForAdmin = async ({
  tenant,
  user,
  actor,
  provisioningId
}) => {
  // Revoke any pending invitations for this user
  await TenantAdminInvitation.updateMany(
    {
      userId: user._id,
      status: INVITATION_STATUSES.PENDING
    },
    { $set: { status: INVITATION_STATUSES.REVOKED } }
  );

  const { rawToken, tokenHash } = generateInvitationToken();
  const invitation = await TenantAdminInvitation.create({
    tenantId: tenant._id,
    userId: user._id,
    email: user.email,
    tokenHash,
    status: INVITATION_STATUSES.PENDING,
    expiresAt: getInvitationExpiryDate(),
    createdByPlatformAdminId: actor?._id || null,
    provisioningId: provisioningId || null
  });

  return {
    invitation,
    rawToken,
    invitationUrl: buildInvitationUrl(tenant.slug, rawToken)
  };
};

/**
 * Continue provisioning from current step state (idempotent).
 */
const runProvisioningPipeline = async (provisioning, { actor, tenantPayload } = {}) => {
  provisioning.status = PROVISIONING_STATUSES.IN_PROGRESS;
  await provisioning.save();

  let tenant = await Tenant.findById(provisioning.tenantId);

  // --- Tenant create (only when not yet linked / step incomplete and no tenant) ---
  if (!isStepComplete(provisioning, PROVISIONING_STEP_KEYS.TENANT_CREATED)) {
    try {
      if (!tenant && tenantPayload) {
        tenant = await tenantService.create({
          name: tenantPayload.name,
          slug: tenantPayload.slug,
          status: tenantPayload.status,
          settings: tenantPayload.settings
        });
        provisioning.tenantId = tenant._id;
        provisioning.tenantSlug = tenant.slug;
        provisioning.tenantName = tenant.name;
      } else if (!tenant) {
        throw new Error("Tenant missing for provisioning");
      }
      markStep(provisioning, PROVISIONING_STEP_KEYS.TENANT_CREATED, PROVISIONING_STEP_STATUSES.COMPLETED);
      await provisioning.save();
    } catch (error) {
      await recordFailure(provisioning, PROVISIONING_STEP_KEYS.TENANT_CREATED, error);
      throw error;
    }
  }

  tenant = await Tenant.findById(provisioning.tenantId);
  if (!tenant) {
    await recordFailure(
      provisioning,
      PROVISIONING_STEP_KEYS.TENANT_CREATED,
      new Error("Tenant not found")
    );
    throw provisioningNotFound();
  }

  // --- Workspace defaults ---
  if (!isStepComplete(provisioning, PROVISIONING_STEP_KEYS.WORKSPACE_INITIALIZED)) {
    try {
      const settings = tenant.settings?.toObject
        ? tenant.settings.toObject()
        : { ...(tenant.settings || {}) };

      settings.organization = {
        ...(settings.organization || {}),
        name: settings.organization?.name || tenant.name,
        displayName: settings.organization?.displayName || tenant.name
      };
      settings.branding = settings.branding || {};
      settings.notifications = settings.notifications || {};
      if (!settings.serviceManagement) {
        const { defaultServiceManagement } = require("../../shared/constants/service-management");
        settings.serviceManagement = defaultServiceManagement();
      }
      tenant.settings = settings;

      // Workspace setup starts NOT_STARTED (distinct from provisioning READY)
      if (!tenant.setup || !tenant.setup.status) {
        const { defaultWorkspaceSetup } = require("../../shared/constants/workspace-setup");
        tenant.setup = defaultWorkspaceSetup();
      }

      await tenant.save();

      provisioning.workspaceUrl = buildWorkspaceUrl(tenant.slug);
      provisioning.tenantName = tenant.name;
      markStep(
        provisioning,
        PROVISIONING_STEP_KEYS.WORKSPACE_INITIALIZED,
        PROVISIONING_STEP_STATUSES.COMPLETED
      );
      await provisioning.save();
    } catch (error) {
      await recordFailure(provisioning, PROVISIONING_STEP_KEYS.WORKSPACE_INITIALIZED, error);
      throw error;
    }
  }

  // --- Tenant ADMIN user ---
  if (!isStepComplete(provisioning, PROVISIONING_STEP_KEYS.ADMIN_CREATED)) {
    try {
      let user = provisioning.tenantAdminUserId
        ? await User.findById(provisioning.tenantAdminUserId)
        : await User.findOne({
            tenantId: tenant._id,
            email: provisioning.tenantAdminEmail
          });

      if (!user) {
        const { firstName, lastName } = splitAdminName(provisioning.tenantAdminName);
        const { USER_STATUSES } = require("../../shared/constants/user-lifecycle");
        user = await User.create({
          tenantId: tenant._id,
          email: provisioning.tenantAdminEmail,
          password: generateUnusablePassword(),
          firstName,
          lastName,
          role: ROLES.ADMIN,
          status: USER_STATUSES.INVITED,
          isActive: false,
          teamId: null,
          applicationIds: []
        });
      }

      provisioning.tenantAdminUserId = user._id;
      markStep(provisioning, PROVISIONING_STEP_KEYS.ADMIN_CREATED, PROVISIONING_STEP_STATUSES.COMPLETED);
      await provisioning.save();

      if (actor) {
        await logPlatformAudit({
          actorPlatformAdminId: actor._id,
          actorEmail: actor.email,
          action: PLATFORM_AUDIT_ACTIONS.TENANT_ADMIN_CREATED,
          targetType: PLATFORM_AUDIT_TARGET_TYPES.TENANT_USER,
          targetId: user._id,
          metadata: {
            tenantId: String(tenant._id),
            email: user.email,
            role: ROLES.ADMIN
          }
        });
      }
    } catch (error) {
      if (error && error.code === 11000) {
        await recordFailure(
          provisioning,
          PROVISIONING_STEP_KEYS.ADMIN_CREATED,
          tenantAdminEmailExists()
        );
        throw tenantAdminEmailExists();
      }
      await recordFailure(provisioning, PROVISIONING_STEP_KEYS.ADMIN_CREATED, error);
      throw error;
    }
  }

  const adminUser = await User.findById(provisioning.tenantAdminUserId);
  if (!adminUser) {
    await recordFailure(
      provisioning,
      PROVISIONING_STEP_KEYS.ADMIN_CREATED,
      new Error("Tenant admin user missing")
    );
    throw new Error("Tenant admin user missing");
  }

  // --- Invitation ---
  let invitationUrl = null;
  if (!isStepComplete(provisioning, PROVISIONING_STEP_KEYS.INVITATION_CREATED)) {
    try {
      const { invitation, invitationUrl: url } = await createInvitationForAdmin({
        tenant,
        user: adminUser,
        actor,
        provisioningId: provisioning._id
      });
      invitationUrl = url;
      provisioning.invitationId = invitation._id;
      markStep(
        provisioning,
        PROVISIONING_STEP_KEYS.INVITATION_CREATED,
        PROVISIONING_STEP_STATUSES.COMPLETED
      );
      await provisioning.save();

      if (actor) {
        await logPlatformAudit({
          actorPlatformAdminId: actor._id,
          actorEmail: actor.email,
          action: PLATFORM_AUDIT_ACTIONS.TENANT_ADMIN_INVITED,
          targetType: PLATFORM_AUDIT_TARGET_TYPES.PROVISIONING,
          targetId: provisioning._id,
          metadata: {
            tenantId: String(tenant._id),
            email: adminUser.email,
            invitationId: String(invitation._id)
          }
        });
      }
    } catch (error) {
      await recordFailure(provisioning, PROVISIONING_STEP_KEYS.INVITATION_CREATED, error);
      throw error;
    }
  }

  // --- Welcome email (failure does not fail overall provisioning) ---
  if (!isStepComplete(provisioning, PROVISIONING_STEP_KEYS.WELCOME_EMAIL)) {
    try {
      if (!invitationUrl) {
        // Need a fresh token for email — create/replace invitation
        const created = await createInvitationForAdmin({
          tenant,
          user: adminUser,
          actor,
          provisioningId: provisioning._id
        });
        invitationUrl = created.invitationUrl;
        provisioning.invitationId = created.invitation._id;
        await provisioning.save();
      }

      const emailResult = await sendTenantAdminInvitationEmail({
        to: adminUser.email,
        adminName: provisioning.tenantAdminName,
        tenantName: tenant.name,
        workspaceUrl: provisioning.workspaceUrl || buildWorkspaceUrl(tenant.slug),
        invitationUrl,
        expiryHours: env.tenantProvisioning.invitationExpiryHours,
        tenant
      });

      if (emailResult.success) {
        markStep(
          provisioning,
          PROVISIONING_STEP_KEYS.WELCOME_EMAIL,
          PROVISIONING_STEP_STATUSES.COMPLETED
        );
      } else {
        markStep(
          provisioning,
          PROVISIONING_STEP_KEYS.WELCOME_EMAIL,
          PROVISIONING_STEP_STATUSES.FAILED,
          emailResult.error || "Email delivery failed"
        );
      }
      await provisioning.save();
    } catch (error) {
      logger.warn("Welcome email step error", { error: error.message });
      markStep(
        provisioning,
        PROVISIONING_STEP_KEYS.WELCOME_EMAIL,
        PROVISIONING_STEP_STATUSES.FAILED,
        error.message
      );
      await provisioning.save();
    }
  }

  // Core success if tenant + admin + invitation done
  const coreReady =
    isStepComplete(provisioning, PROVISIONING_STEP_KEYS.TENANT_CREATED) &&
    isStepComplete(provisioning, PROVISIONING_STEP_KEYS.WORKSPACE_INITIALIZED) &&
    isStepComplete(provisioning, PROVISIONING_STEP_KEYS.ADMIN_CREATED) &&
    isStepComplete(provisioning, PROVISIONING_STEP_KEYS.INVITATION_CREATED);

  if (coreReady) {
    provisioning.status = PROVISIONING_STATUSES.READY;
    provisioning.completedAt = provisioning.completedAt || new Date();
    provisioning.failure = { code: null, message: null, atStep: null, at: null };
    await provisioning.save();

    if (actor) {
      await logPlatformAudit({
        actorPlatformAdminId: actor._id,
        actorEmail: actor.email,
        action: PLATFORM_AUDIT_ACTIONS.TENANT_PROVISIONING_COMPLETED,
        targetType: PLATFORM_AUDIT_TARGET_TYPES.PROVISIONING,
        targetId: provisioning._id,
        metadata: {
          tenantId: String(tenant._id),
          slug: tenant.slug,
          emailStep: provisioning.steps.welcomeEmail?.status
        }
      });
    }
  }

  return provisioning;
};

/**
 * Full business onboarding: create tenant + admin + invitation + email.
 */
const provisionTenant = async ({ tenant: tenantInput, admin: adminInput }, { actor } = {}) => {
  if (!actor) {
    throw provisioningConflict("Platform admin required");
  }

  const name = String(tenantInput?.name || "").trim();
  const slug = String(tenantInput?.slug || "").trim().toLowerCase();
  const adminName = String(adminInput?.name || "").trim();
  const adminEmail = String(adminInput?.email || "").trim().toLowerCase();

  if (!name || !slug || !adminName || !adminEmail) {
    const ApiError = require("../../shared/utils/ApiError");
    throw new ApiError(400, "tenant.name, tenant.slug, admin.name, and admin.email are required");
  }

  const existingTenant = await tenantService.findBySlug(slug);
  if (existingTenant) {
    const existingProv = await TenantProvisioning.findOne({ tenantId: existingTenant._id });
    if (existingProv) {
      throw provisioningConflict(`Tenant slug already provisioned: ${slug}`);
    }
    throw provisioningConflict(`Tenant slug already exists: ${slug}`);
  }

  // Create tenant first (unique slug), then provisioning record
  let tenant;
  try {
    tenant = await tenantService.create({
      name,
      slug,
      status: tenantInput.status,
      settings: tenantInput.settings
    });
  } catch (error) {
    throw error;
  }

  let provisioning;
  try {
    provisioning = await TenantProvisioning.create({
      tenantId: tenant._id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      requestedByPlatformAdminId: actor._id,
      tenantAdminName: adminName,
      tenantAdminEmail: adminEmail,
      workspaceUrl: buildWorkspaceUrl(tenant.slug),
      status: PROVISIONING_STATUSES.IN_PROGRESS,
      steps: defaultProvisioningSteps()
    });
  } catch (error) {
    if (error && error.code === 11000) {
      throw provisioningConflict("Provisioning already exists for this tenant");
    }
    throw error;
  }

  markStep(provisioning, PROVISIONING_STEP_KEYS.TENANT_CREATED, PROVISIONING_STEP_STATUSES.COMPLETED);
  await provisioning.save();

  await logPlatformAudit({
    actorPlatformAdminId: actor._id,
    actorEmail: actor.email,
    action: PLATFORM_AUDIT_ACTIONS.TENANT_PROVISIONING_STARTED,
    targetType: PLATFORM_AUDIT_TARGET_TYPES.PROVISIONING,
    targetId: provisioning._id,
    metadata: { tenantId: String(tenant._id), slug: tenant.slug, adminEmail }
  });

  await logPlatformAudit({
    actorPlatformAdminId: actor._id,
    actorEmail: actor.email,
    action: PLATFORM_AUDIT_ACTIONS.TENANT_CREATED,
    targetType: PLATFORM_AUDIT_TARGET_TYPES.TENANT,
    targetId: tenant._id,
    metadata: { slug: tenant.slug, via: "provision" }
  });

  try {
    await runProvisioningPipeline(provisioning, { actor });
  } catch (error) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_PROVISIONING_FAILED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.PROVISIONING,
      targetId: provisioning._id,
      metadata: {
        message: error.message,
        atStep: provisioning.failure?.atStep
      }
    });
    // Return failed provisioning rather than opaque 500 when operational
    const refreshed = await TenantProvisioning.findById(provisioning._id);
    if (refreshed?.status === PROVISIONING_STATUSES.FAILED) {
      return toPublicProvisioning(refreshed);
    }
    throw error;
  }

  const finalDoc = await TenantProvisioning.findById(provisioning._id);
  return toPublicProvisioning(finalDoc);
};

const listProvisionings = async ({ status, tenantId, search, limit = 50, skip = 0 } = {}) => {
  const query = {};
  if (status) {
    query.status = status;
  }
  if (tenantId) {
    query.tenantId = tenantId;
  }
  if (search) {
    const term = String(search).trim();
    if (term) {
      query.$or = [
        { tenantName: { $regex: term, $options: "i" } },
        { tenantSlug: { $regex: term, $options: "i" } },
        { tenantAdminEmail: { $regex: term, $options: "i" } }
      ];
    }
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeSkip = Math.max(parseInt(skip, 10) || 0, 0);

  const [items, total] = await Promise.all([
    TenantProvisioning.find(query).sort({ createdAt: -1 }).skip(safeSkip).limit(safeLimit),
    TenantProvisioning.countDocuments(query)
  ]);

  return {
    items: items.map(toPublicProvisioning),
    total,
    limit: safeLimit,
    skip: safeSkip
  };
};

const getProvisioning = async (id) => {
  const doc = await TenantProvisioning.findById(id);
  if (!doc) {
    throw provisioningNotFound();
  }
  return toPublicProvisioning(doc);
};

const retryProvisioning = async (id, { actor } = {}) => {
  const provisioning = await TenantProvisioning.findById(id);
  if (!provisioning) {
    throw provisioningNotFound();
  }

  if (provisioning.status === PROVISIONING_STATUSES.READY) {
    // Allow retry only for failed email step
    if (
      provisioning.steps?.welcomeEmail?.status === PROVISIONING_STEP_STATUSES.FAILED ||
      provisioning.steps?.welcomeEmail?.status === PROVISIONING_STEP_STATUSES.PENDING
    ) {
      markStep(
        provisioning,
        PROVISIONING_STEP_KEYS.WELCOME_EMAIL,
        PROVISIONING_STEP_STATUSES.PENDING
      );
      // Force new invitation token for email
      markStep(
        provisioning,
        PROVISIONING_STEP_KEYS.INVITATION_CREATED,
        PROVISIONING_STEP_STATUSES.PENDING
      );
    } else {
      throw provisioningNotRetriable("Provisioning is already READY");
    }
  }

  if (actor) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_PROVISIONING_RETRIED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.PROVISIONING,
      targetId: provisioning._id,
      metadata: { previousStatus: provisioning.status }
    });
  }

  // Reset failed non-email steps to PENDING so pipeline retries them
  for (const key of Object.values(PROVISIONING_STEP_KEYS)) {
    if (provisioning.steps?.[key]?.status === PROVISIONING_STEP_STATUSES.FAILED) {
      markStep(provisioning, key, PROVISIONING_STEP_STATUSES.PENDING);
    }
  }

  await runProvisioningPipeline(provisioning, { actor });
  return toPublicProvisioning(await TenantProvisioning.findById(id));
};

const resendInvitation = async (id, { actor } = {}) => {
  const provisioning = await TenantProvisioning.findById(id);
  if (!provisioning) {
    throw provisioningNotFound();
  }

  const tenant = await Tenant.findById(provisioning.tenantId);
  const user = await User.findById(provisioning.tenantAdminUserId);
  if (!tenant || !user) {
    throw provisioningNotRetriable("Tenant or admin missing; run retry first");
  }

  if (user.isActive) {
    throw provisioningNotRetriable("Tenant admin has already activated their account");
  }

  const { invitation, invitationUrl } = await createInvitationForAdmin({
    tenant,
    user,
    actor,
    provisioningId: provisioning._id
  });

  provisioning.invitationId = invitation._id;
  markStep(
    provisioning,
    PROVISIONING_STEP_KEYS.INVITATION_CREATED,
    PROVISIONING_STEP_STATUSES.COMPLETED
  );

  const emailResult = await sendTenantAdminInvitationEmail({
    to: user.email,
    adminName: provisioning.tenantAdminName,
    tenantName: tenant.name,
    workspaceUrl: provisioning.workspaceUrl || buildWorkspaceUrl(tenant.slug),
    invitationUrl,
    expiryHours: env.tenantProvisioning.invitationExpiryHours,
    tenant
  });

  if (emailResult.success) {
    markStep(
      provisioning,
      PROVISIONING_STEP_KEYS.WELCOME_EMAIL,
      PROVISIONING_STEP_STATUSES.COMPLETED
    );
  } else {
    markStep(
      provisioning,
      PROVISIONING_STEP_KEYS.WELCOME_EMAIL,
      PROVISIONING_STEP_STATUSES.FAILED,
      emailResult.error || "Email delivery failed"
    );
  }

  if (provisioning.status !== PROVISIONING_STATUSES.READY) {
    provisioning.status = PROVISIONING_STATUSES.READY;
    provisioning.completedAt = provisioning.completedAt || new Date();
  }

  await provisioning.save();

  if (actor) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_INVITATION_RESENT,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.PROVISIONING,
      targetId: provisioning._id,
      metadata: {
        invitationId: String(invitation._id),
        emailStatus: emailResult.success ? "SENT" : "FAILED"
      }
    });
  }

  return toPublicProvisioning(provisioning);
};

/**
 * Public: validate invitation token — generic invalid responses.
 */
const validateInvitationToken = async (rawToken) => {
  if (!rawToken || String(rawToken).length < 16) {
    return { valid: false };
  }

  const tokenHash = hashInvitationToken(rawToken);
  const invitation = await TenantAdminInvitation.findOne({ tokenHash }).select("+tokenHash");

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
  if (!tenant || !user || user.isActive) {
    return { valid: false };
  }

  const { publicBrandingPayload } = require("../workspace/workspace.service");
  const branding = publicBrandingPayload(tenant);

  return {
    valid: true,
    invitationType: "TENANT_ADMIN",
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
 * Public: complete account setup with token + password.
 */
const completeAccountSetup = async ({ token, password, confirmPassword }) => {
  assertValidPassword(password);
  if (confirmPassword !== undefined && confirmPassword !== password) {
    const ApiError = require("../../shared/utils/ApiError");
    throw new ApiError(400, "Passwords do not match");
  }

  if (!token || String(token).length < 16) {
    throw invalidInvitation();
  }

  const tokenHash = hashInvitationToken(token);
  const invitation = await TenantAdminInvitation.findOne({ tokenHash }).select("+tokenHash");

  if (!invitation) {
    throw invalidInvitation();
  }

  if (invitation.status === INVITATION_STATUSES.ACCEPTED) {
    throw invitationAlreadyUsed();
  }

  if (invitation.status === INVITATION_STATUSES.REVOKED) {
    throw invalidInvitation();
  }

  if (
    invitation.status === INVITATION_STATUSES.EXPIRED ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    invitation.status = INVITATION_STATUSES.EXPIRED;
    await invitation.save();
    throw invitationExpired();
  }

  if (invitation.status !== INVITATION_STATUSES.PENDING) {
    throw invalidInvitation();
  }

  const user = await User.findById(invitation.userId).select("+password");
  if (!user || user.isActive) {
    throw invalidInvitation();
  }

  const { USER_STATUSES } = require("../../shared/constants/user-lifecycle");
  user.password = password;
  user.status = USER_STATUSES.ACTIVE;
  user.isActive = true;
  await user.save();

  invitation.status = INVITATION_STATUSES.ACCEPTED;
  invitation.acceptedAt = new Date();
  // Rotate hash so raw token cannot be reused even if status were tampered
  invitation.tokenHash = hashInvitationToken(`${token}:accepted:${invitation._id}`);
  await invitation.save();

  return {
    success: true,
    tenantSlug: (await Tenant.findById(invitation.tenantId))?.slug || null,
    email: user.email
  };
};

module.exports = {
  provisionTenant,
  listProvisionings,
  getProvisioning,
  retryProvisioning,
  resendInvitation,
  validateInvitationToken,
  completeAccountSetup,
  toPublicProvisioning,
  runProvisioningPipeline,
  // test helpers
  hashInvitationToken,
  generateInvitationToken
};
