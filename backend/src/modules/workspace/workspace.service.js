const path = require("path");
const fs = require("fs");
const ApiError = require("../../shared/utils/ApiError");
const Tenant = require("../tenants/tenant.model");
const Application = require("../applications/application.model");
const Team = require("../teams/team.model");
const User = require("../users/user.model");
const MerchantProfile = require("../merchants/merchant-profile.model");
const { ROLES } = require("../../shared/constants/roles");
const {
  WORKSPACE_SETUP_STATUSES,
  REQUIRED_SETUP_STEPS,
  ALL_SETUP_STEPS,
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_BYTES,
  defaultWorkspaceSetup
} = require("../../shared/constants/workspace-setup");
const { normalizeHexColor } = require("../../shared/constants/default-branding");
const {
  DEFAULT_CUSTOMER_LABEL,
  normalizeCustomerLabel,
  isValidCustomerLabel
} = require("../../shared/constants/customer-labels");
const {
  buildEmailBranding,
  buildBrandingStorageFolder
} = require("../../shared/utils/tenant-ops.util");
const { createGoogleDriveService } = require("../../shared/services/google-drive/google-drive.service");
const env = require("../../config/env");
const { logAudit } = require("../audit/audit.service");
const { AUDIT_ACTIONS, ACTOR_TYPES, ENTITY_TYPES } = require("../../shared/constants/audit-actions");

const driveService = createGoogleDriveService();

const workspaceActorName = (actor) =>
  actor ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email || "Admin" : "Admin";

const logWorkspaceAudit = async (action, tenantId, actor, metadata = {}) => {
  await logAudit({
    entityType: ENTITY_TYPES.WORKSPACE,
    entityId: tenantId,
    action,
    actorType: ACTOR_TYPES.AGENT,
    actorId: actor?._id || null,
    actorName: workspaceActorName(actor),
    tenantId,
    metadata,
    skipNotificationEvent: true
  });
};

const ORGANIZATION_FIELDS = [
  "displayName",
  "legalName",
  "supportDisplayName",
  "primaryContactName",
  "primaryContactEmail",
  "supportEmail",
  "phone",
  "website",
  "timezone",
  "country",
  "address"
];

const BRANDING_PATCH_FIELDS = [
  "supportDisplayName",
  "primaryColor",
  "secondaryColor",
  "loginTitle",
  "loginSubtitle",
  "faviconUrl"
];

const toPlainSettings = (tenant) => {
  const settings = tenant.settings?.toObject
    ? tenant.settings.toObject()
    : { ...(tenant.settings || {}) };
  return {
    organization: { ...(settings.organization || {}) },
    branding: { ...(settings.branding || {}) },
    support: { ...(settings.support || {}) },
    notifications: { ...(settings.notifications || {}) },
    serviceManagement: settings.serviceManagement || null
  };
};

const brandingResponse = (branding = {}) => ({
  supportDisplayName: branding.supportDisplayName || "",
  primaryColor: branding.primaryColor || null,
  secondaryColor: branding.secondaryColor || null,
  loginTitle: branding.loginTitle || "",
  loginSubtitle: branding.loginSubtitle || "",
  faviconUrl: branding.faviconUrl || null,
  logoFileId: branding.logoFileId || null,
  logoFileName: branding.logoFileName || null,
  logoMimeType: branding.logoMimeType || null,
  logoUrl: branding.logoFileId ? "/api/workspace/branding/logo" : null
});

const supportResponse = (support = {}) => ({
  customerLabel: normalizeCustomerLabel(support.customerLabel),
  supportEmailDisplayName: support.supportEmailDisplayName || ""
});

const parseOptionalHex = (value, fieldName) => {
  if (value === null || value === "") {
    return null;
  }
  const normalized = normalizeHexColor(value);
  if (!normalized) {
    throw new ApiError(400, `${fieldName} must be a hex color (#RGB or #RRGGBB)`);
  }
  return normalized;
};

const toPlainSetup = (tenant) => {
  if (!tenant.setup) {
    return defaultWorkspaceSetup();
  }
  const setup = tenant.setup?.toObject ? tenant.setup.toObject() : { ...tenant.setup };
  return {
    status: setup.status || WORKSPACE_SETUP_STATUSES.NOT_STARTED,
    steps: {
      organization: Boolean(setup.steps?.organization),
      branding: Boolean(setup.steps?.branding),
      team: Boolean(setup.steps?.team),
      application: Boolean(setup.steps?.application),
      users: Boolean(setup.steps?.users),
      client: Boolean(setup.steps?.client)
    },
    skipped: {
      branding: Boolean(setup.skipped?.branding),
      users: Boolean(setup.skipped?.users),
      client: Boolean(setup.skipped?.client)
    },
    completedAt: setup.completedAt || null
  };
};

const sanitizeString = (value, max = 200) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.slice(0, max);
};

const isValidEmail = (value) => {
  if (!value) {
    return true;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const isValidUrl = (value) => {
  if (!value) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const organizationIsComplete = (org = {}) => {
  const displayName = String(org.displayName || org.name || "").trim();
  const supportEmail = String(org.supportEmail || org.primaryContactEmail || "").trim();
  return Boolean(displayName) && Boolean(supportEmail);
};

const brandingIsConfigured = (branding = {}) => {
  const display = String(branding.supportDisplayName || "").trim();
  const primary = String(branding.primaryColor || "").trim();
  return Boolean(display) || Boolean(branding.logoFileId) || Boolean(primary);
};

/**
 * Recompute setup steps from real tenant data + stored skips.
 * Does not invent completion — reflects actual state.
 */
const recomputeSetup = async (tenant) => {
  const tenantId = tenant._id;
  const settings = toPlainSettings(tenant);
  const previous = toPlainSetup(tenant);

  const [teamCount, applicationCount, extraUserCount, clientCount] = await Promise.all([
    Team.countDocuments({ tenantId, isActive: true }),
    Application.countDocuments({ tenantId, isActive: true }),
    User.countDocuments({
      tenantId,
      isActive: true,
      role: { $in: [ROLES.TEAM_LEAD, ROLES.AGENT, ROLES.ADMIN] }
    }),
    MerchantProfile.countDocuments({ tenantId, isActive: true })
  ]);

  // users step: at least 2 active staff (admin + someone else), or skip
  const hasAdditionalUsers = extraUserCount >= 2;

  const steps = {
    organization: organizationIsComplete(settings.organization),
    branding: brandingIsConfigured(settings.branding) || previous.skipped.branding,
    team: teamCount >= 1,
    application: applicationCount >= 1,
    users: hasAdditionalUsers || previous.skipped.users,
    client: clientCount >= 1 || previous.skipped.client
  };

  const requiredDone = REQUIRED_SETUP_STEPS.every((key) => steps[key]);
  const anyStarted = ALL_SETUP_STEPS.some((key) => steps[key]) || previous.status !== WORKSPACE_SETUP_STATUSES.NOT_STARTED;

  let status = WORKSPACE_SETUP_STATUSES.NOT_STARTED;
  let completedAt = previous.completedAt;

  if (requiredDone) {
    status = WORKSPACE_SETUP_STATUSES.COMPLETED;
    completedAt = completedAt || new Date();
  } else if (anyStarted || Object.values(steps).some(Boolean)) {
    status = WORKSPACE_SETUP_STATUSES.IN_PROGRESS;
    completedAt = null;
  }

  return {
    status,
    steps,
    skipped: previous.skipped,
    completedAt,
    progress: {
      completed: ALL_SETUP_STEPS.filter((k) => steps[k]).length,
      total: ALL_SETUP_STEPS.length,
      requiredCompleted: REQUIRED_SETUP_STEPS.filter((k) => steps[k]).length,
      requiredTotal: REQUIRED_SETUP_STEPS.length
    }
  };
};

const persistSetup = async (tenant, setup) => {
  tenant.setup = {
    status: setup.status,
    steps: setup.steps,
    skipped: setup.skipped,
    completedAt: setup.completedAt
  };
  await tenant.save();
  return toPlainSetup(tenant);
};

const refreshAndSaveSetup = async (tenant) => {
  const computed = await recomputeSetup(tenant);
  await persistSetup(tenant, computed);
  return computed;
};

const getTenantOrThrow = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, "Tenant not found");
  }
  return tenant;
};

/**
 * Safe public branding — no secrets, no tenant ObjectIds, no admin data.
 * Hostname/context already established the tenant; slug is not an enumeration vector here.
 */
const publicBrandingPayload = (tenant) => {
  const settings = toPlainSettings(tenant);
  const emailBranding = buildEmailBranding(tenant);
  const hasLogo = Boolean(settings.branding.logoFileId);
  const organizationName = settings.organization.displayName || tenant.name;
  const customerLabel = normalizeCustomerLabel(settings.support.customerLabel);
  const primaryColor =
    normalizeHexColor(settings.branding.primaryColor) || null;
  const secondaryColor =
    normalizeHexColor(settings.branding.secondaryColor) || null;

  return {
    organizationName,
    supportDisplayName: emailBranding.supportDisplayName,
    primaryColor,
    secondaryColor,
    loginTitle: settings.branding.loginTitle || "",
    loginSubtitle: settings.branding.loginSubtitle || "",
    customerLabel,
    logoAvailable: hasLogo,
    // Phase 9 compatibility aliases
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    displayName: organizationName,
    logoUrl: hasLogo ? "/api/workspace/branding/logo" : null,
    hasLogo
  };
};

const getSettings = async (tenantId) => {
  const tenant = await getTenantOrThrow(tenantId);
  const settings = toPlainSettings(tenant);
  const setup = await refreshAndSaveSetup(tenant);

  return {
    tenant: {
      id: String(tenant._id),
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status
    },
    organization: settings.organization,
    branding: brandingResponse(settings.branding),
    support: supportResponse(settings.support),
    notifications: settings.notifications,
    serviceManagement: settings.serviceManagement || require("../../shared/constants/service-management").defaultServiceManagement(),
    setup,
    emailBranding: buildEmailBranding(tenant)
  };
};

const getSetupStatus = async (tenantId) => {
  const tenant = await getTenantOrThrow(tenantId);
  return refreshAndSaveSetup(tenant);
};

const getPublicBranding = async (tenantId) => {
  const tenant = await getTenantOrThrow(tenantId);
  return publicBrandingPayload(tenant);
};

const updateOrganization = async (tenantId, payload = {}, { actor } = {}) => {
  const tenant = await getTenantOrThrow(tenantId);
  const settings = toPlainSettings(tenant);
  const next = { ...settings.organization };

  for (const field of ORGANIZATION_FIELDS) {
    if (payload[field] !== undefined) {
      next[field] = sanitizeString(payload[field], field === "address" ? 500 : 200);
    }
  }

  // Keep legacy `name` aligned with displayName for older readers
  if (next.displayName) {
    next.name = next.displayName;
  }

  if (next.primaryContactEmail && !isValidEmail(next.primaryContactEmail)) {
    throw new ApiError(400, "Invalid primary contact email");
  }
  if (next.supportEmail && !isValidEmail(next.supportEmail)) {
    throw new ApiError(400, "Invalid support contact email");
  }
  if (next.website && !isValidUrl(next.website)) {
    throw new ApiError(400, "Invalid website URL");
  }

  settings.organization = next;
  tenant.settings = settings;
  await tenant.save();

  const setup = await refreshAndSaveSetup(tenant);
  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_ORGANIZATION_UPDATED, tenantId, actor, {
    displayName: next.displayName || null
  });
  if (setup.status === WORKSPACE_SETUP_STATUSES.COMPLETED) {
    await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_SETUP_COMPLETED, tenantId, actor, {
      via: "organization"
    });
  }
  return { organization: next, setup };
};

const updateBranding = async (tenantId, payload = {}, { actor } = {}) => {
  const tenant = await getTenantOrThrow(tenantId);
  const settings = toPlainSettings(tenant);
  const next = { ...settings.branding };
  const changed = {};

  if (payload.supportDisplayName !== undefined) {
    next.supportDisplayName = sanitizeString(payload.supportDisplayName, 120);
    changed.supportDisplayName = true;
  }

  if (payload.primaryColor !== undefined) {
    next.primaryColor = parseOptionalHex(payload.primaryColor, "primaryColor");
    changed.primaryColor = next.primaryColor;
  }

  if (payload.secondaryColor !== undefined) {
    next.secondaryColor = parseOptionalHex(payload.secondaryColor, "secondaryColor");
    changed.secondaryColor = next.secondaryColor;
  }

  if (payload.loginTitle !== undefined) {
    next.loginTitle = sanitizeString(payload.loginTitle, 160);
    changed.loginTitle = true;
  }

  if (payload.loginSubtitle !== undefined) {
    next.loginSubtitle = sanitizeString(payload.loginSubtitle, 300);
    changed.loginSubtitle = true;
  }

  if (payload.faviconUrl !== undefined) {
    // Future-ready: store only null or empty for now; reject non-empty arbitrary URLs
    const favicon = payload.faviconUrl === null || payload.faviconUrl === ""
      ? null
      : sanitizeString(payload.faviconUrl, 500);
    if (favicon && !/^https?:\/\//i.test(favicon)) {
      throw new ApiError(400, "faviconUrl must be an http(s) URL or empty");
    }
    next.faviconUrl = favicon;
    changed.faviconUrl = Boolean(favicon);
  }

  settings.branding = next;
  tenant.settings = settings;

  // Clearing skip when branding is configured
  if (brandingIsConfigured(next) && tenant.setup?.skipped) {
    const setup = toPlainSetup(tenant);
    setup.skipped.branding = false;
    tenant.setup = { ...setup, steps: setup.steps };
  }

  await tenant.save();
  const setup = await refreshAndSaveSetup(tenant);

  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_BRANDING_UPDATED, tenantId, actor, {
    fields: Object.keys(changed)
  });

  return {
    branding: brandingResponse(next),
    setup
  };
};

const updateSupportSettings = async (tenantId, payload = {}, { actor } = {}) => {
  const tenant = await getTenantOrThrow(tenantId);
  const settings = toPlainSettings(tenant);
  const next = { ...settings.support };
  const previousLabel = normalizeCustomerLabel(next.customerLabel);
  let customerLabelChanged = false;

  if (payload.customerLabel !== undefined) {
    if (!isValidCustomerLabel(payload.customerLabel)) {
      throw new ApiError(
        400,
        "customerLabel must be one of: CLIENT, CUSTOMER, MERCHANT"
      );
    }
    next.customerLabel = normalizeCustomerLabel(payload.customerLabel);
    customerLabelChanged = next.customerLabel !== previousLabel;
  }

  if (payload.supportEmailDisplayName !== undefined) {
    next.supportEmailDisplayName = sanitizeString(payload.supportEmailDisplayName, 120);
  }

  // Optional sync: allow supportDisplayName via support PATCH without duplicating ownership —
  // write through to branding when provided.
  if (payload.supportDisplayName !== undefined) {
    settings.branding = {
      ...settings.branding,
      supportDisplayName: sanitizeString(payload.supportDisplayName, 120)
    };
  }

  settings.support = next;
  tenant.settings = settings;
  await tenant.save();

  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_SUPPORT_SETTINGS_UPDATED, tenantId, actor, {
    customerLabel: next.customerLabel || DEFAULT_CUSTOMER_LABEL
  });

  if (customerLabelChanged) {
    await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_CUSTOMER_LABEL_UPDATED, tenantId, actor, {
      from: previousLabel,
      to: next.customerLabel
    });
  }

  if (payload.supportDisplayName !== undefined) {
    await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_BRANDING_UPDATED, tenantId, actor, {
      fields: ["supportDisplayName"],
      via: "support"
    });
  }

  return {
    support: supportResponse(next),
    branding: brandingResponse(settings.branding)
  };
};

const skipSetupStep = async (tenantId, step, { actor } = {}) => {
  const skippable = ["users", "client"];
  if (!skippable.includes(step)) {
    throw new ApiError(400, "This setup step cannot be skipped");
  }

  const tenant = await getTenantOrThrow(tenantId);
  const setup = toPlainSetup(tenant);
  setup.skipped[step] = true;
  tenant.setup = setup;
  await tenant.save();
  const result = await refreshAndSaveSetup(tenant);
  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_SETUP_SKIPPED, tenantId, actor, { step });
  return result;
};

const uploadLogo = async (tenantId, file, { actor } = {}) => {
  if (!file) {
    throw new ApiError(400, "File is required");
  }

  if (!LOGO_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new ApiError(400, `Logo type not allowed: ${file.mimetype}. Use PNG, JPEG, or WebP.`);
  }

  if (file.size > LOGO_MAX_BYTES) {
    throw new ApiError(400, "Logo too large (max 2MB)");
  }

  const tenant = await getTenantOrThrow(tenantId);
  const folder = buildBrandingStorageFolder(tenant.slug);

  const upload = await driveService.uploadFile(folder, {
    ...file,
    originalname: `logo${path.extname(file.originalname || "").toLowerCase() || ".png"}`
  });

  const settings = toPlainSettings(tenant);
  settings.branding = {
    ...settings.branding,
    logoFileId: upload.driveFileId,
    logoFileName: upload.fileName,
    logoMimeType: file.mimetype,
    logoStorageFolder: folder
  };
  tenant.settings = settings;

  const setupPlain = toPlainSetup(tenant);
  setupPlain.skipped.branding = false;
  tenant.setup = setupPlain;
  await tenant.save();

  const setup = await refreshAndSaveSetup(tenant);

  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_LOGO_UPLOADED, tenantId, actor, {
    logoFileName: settings.branding.logoFileName
  });
  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_LOGO_UPDATED, tenantId, actor, {
    logoFileName: settings.branding.logoFileName
  });

  return {
    branding: brandingResponse(settings.branding),
    setup
  };
};

const deleteLogo = async (tenantId, { actor } = {}) => {
  const tenant = await getTenantOrThrow(tenantId);
  const settings = toPlainSettings(tenant);
  const folder = settings.branding.logoStorageFolder || buildBrandingStorageFolder(tenant.slug);
  const fileName = settings.branding.logoFileName;

  if (fileName) {
    const localPath = path.join(env.uploadsDir, folder, fileName);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch {
        // best-effort cleanup for mock storage
      }
    }
  }

  delete settings.branding.logoFileId;
  delete settings.branding.logoFileName;
  delete settings.branding.logoMimeType;
  delete settings.branding.logoStorageFolder;
  tenant.settings = settings;
  await tenant.save();

  const setup = await refreshAndSaveSetup(tenant);
  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_LOGO_DELETED, tenantId, actor);
  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_LOGO_REMOVED, tenantId, actor);
  return {
    branding: brandingResponse(settings.branding),
    setup
  };
};

/**
 * Resolve logo file buffer for the requesting tenant only.
 */
const getLogoFile = async (tenantId) => {
  const tenant = await getTenantOrThrow(tenantId);
  const settings = toPlainSettings(tenant);
  const branding = settings.branding || {};

  if (!branding.logoFileId || !branding.logoFileName) {
    throw new ApiError(404, "Logo not found");
  }

  const folder = branding.logoStorageFolder || buildBrandingStorageFolder(tenant.slug);
  const localPath = path.join(env.uploadsDir, folder, branding.logoFileName);

  if (!fs.existsSync(localPath)) {
    throw new ApiError(404, "Logo file missing from storage");
  }

  return {
    buffer: fs.readFileSync(localPath),
    mimeType: branding.logoMimeType || "application/octet-stream",
    fileName: branding.logoFileName
  };
};

/** Platform-safe summary (no private branding assets). */
const setupSummaryForPlatform = (tenant) => {
  const setup = toPlainSetup(tenant);
  const completed = ALL_SETUP_STEPS.filter((k) => setup.steps[k]).length;
  return {
    status: setup.status,
    progress: {
      completed,
      total: ALL_SETUP_STEPS.length
    },
    completedAt: setup.completedAt
  };
};

const getServiceManagementSettings = async (tenantId) => {
  const { ensureServiceManagementDefaults, getServiceManagement } = require("../tickets/sla.service");
  const tenant = await getTenantOrThrow(tenantId);
  await ensureServiceManagementDefaults(tenant);
  return getServiceManagement(tenantId);
};

const updateServiceManagementSettings = async (tenantId, payload = {}, { actor } = {}) => {
  const { defaultServiceManagement } = require("../../shared/constants/service-management");
  const tenant = await getTenantOrThrow(tenantId);
  const settings = toPlainSettings(tenant);
  const current = settings.serviceManagement || defaultServiceManagement();
  const next = { ...current };

  if (payload.priorities !== undefined) {
    if (!Array.isArray(payload.priorities)) {
      throw new ApiError(400, "priorities must be an array");
    }
    next.priorities = payload.priorities;
  }
  if (payload.businessHours !== undefined) {
    next.businessHours = { ...current.businessHours, ...payload.businessHours };
  }
  if (payload.slaPolicies !== undefined) {
    if (!Array.isArray(payload.slaPolicies)) {
      throw new ApiError(400, "slaPolicies must be an array");
    }
    next.slaPolicies = payload.slaPolicies;
  }
  if (payload.escalationRules !== undefined) {
    if (!Array.isArray(payload.escalationRules)) {
      throw new ApiError(400, "escalationRules must be an array");
    }
    next.escalationRules = payload.escalationRules;
  }
  if (payload.agentMaxActiveTickets !== undefined) {
    const n = Number(payload.agentMaxActiveTickets);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      throw new ApiError(400, "agentMaxActiveTickets must be between 1 and 100");
    }
    next.agentMaxActiveTickets = Math.floor(n);
  }

  settings.serviceManagement = next;
  tenant.settings = settings;
  tenant.markModified("settings");
  await tenant.save();

  await logWorkspaceAudit(AUDIT_ACTIONS.WORKSPACE_SERVICE_MANAGEMENT_UPDATED, tenantId, actor, {
    updatedKeys: Object.keys(payload)
  });

  return next;
};

module.exports = {
  getSettings,
  getSetupStatus,
  getPublicBranding,
  publicBrandingPayload,
  updateOrganization,
  updateBranding,
  updateSupportSettings,
  getServiceManagementSettings,
  updateServiceManagementSettings,
  skipSetupStep,
  uploadLogo,
  deleteLogo,
  getLogoFile,
  recomputeSetup,
  refreshAndSaveSetup,
  setupSummaryForPlatform,
  organizationIsComplete,
  brandingIsConfigured
};
