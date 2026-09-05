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
  PRIMARY_COLOR_PATTERN,
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_BYTES,
  defaultWorkspaceSetup
} = require("../../shared/constants/workspace-setup");
const {
  buildEmailBranding,
  buildBrandingStorageFolder
} = require("../../shared/utils/tenant-ops.util");
const { createGoogleDriveService } = require("../../shared/services/google-drive/google-drive.service");
const env = require("../../config/env");

const driveService = createGoogleDriveService();

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

const BRANDING_PATCH_FIELDS = ["supportDisplayName", "primaryColor"];

const toPlainSettings = (tenant) => {
  const settings = tenant.settings?.toObject
    ? tenant.settings.toObject()
    : { ...(tenant.settings || {}) };
  return {
    organization: { ...(settings.organization || {}) },
    branding: { ...(settings.branding || {}) },
    notifications: { ...(settings.notifications || {}) }
  };
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
  return Boolean(display) || Boolean(branding.logoFileId);
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

const publicBrandingPayload = (tenant) => {
  const settings = toPlainSettings(tenant);
  const emailBranding = buildEmailBranding(tenant);
  const hasLogo = Boolean(settings.branding.logoFileId);

  return {
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    displayName: settings.organization.displayName || tenant.name,
    supportDisplayName: emailBranding.supportDisplayName,
    primaryColor: settings.branding.primaryColor || null,
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
    branding: {
      supportDisplayName: settings.branding.supportDisplayName || "",
      primaryColor: settings.branding.primaryColor || null,
      logoFileId: settings.branding.logoFileId || null,
      logoFileName: settings.branding.logoFileName || null,
      logoMimeType: settings.branding.logoMimeType || null,
      logoUrl: settings.branding.logoFileId ? "/api/workspace/branding/logo" : null
    },
    notifications: settings.notifications,
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

const updateOrganization = async (tenantId, payload = {}) => {
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
  return { organization: next, setup };
};

const updateBranding = async (tenantId, payload = {}) => {
  const tenant = await getTenantOrThrow(tenantId);
  const settings = toPlainSettings(tenant);
  const next = { ...settings.branding };

  if (payload.supportDisplayName !== undefined) {
    next.supportDisplayName = sanitizeString(payload.supportDisplayName, 120);
  }

  if (payload.primaryColor !== undefined) {
    const color = payload.primaryColor === null || payload.primaryColor === ""
      ? null
      : String(payload.primaryColor).trim();
    if (color && !PRIMARY_COLOR_PATTERN.test(color)) {
      throw new ApiError(400, "primaryColor must be a hex color (#RGB or #RRGGBB)");
    }
    next.primaryColor = color;
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

  return {
    branding: {
      supportDisplayName: next.supportDisplayName || "",
      primaryColor: next.primaryColor || null,
      logoFileId: next.logoFileId || null,
      logoFileName: next.logoFileName || null,
      logoMimeType: next.logoMimeType || null,
      logoUrl: next.logoFileId ? "/api/workspace/branding/logo" : null
    },
    setup
  };
};

const skipSetupStep = async (tenantId, step) => {
  const skippable = ["branding", "users", "client"];
  if (!skippable.includes(step)) {
    throw new ApiError(400, "This setup step cannot be skipped");
  }

  const tenant = await getTenantOrThrow(tenantId);
  const setup = toPlainSetup(tenant);
  setup.skipped[step] = true;
  tenant.setup = setup;
  await tenant.save();
  return refreshAndSaveSetup(tenant);
};

const uploadLogo = async (tenantId, file) => {
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

  return {
    branding: {
      supportDisplayName: settings.branding.supportDisplayName || "",
      primaryColor: settings.branding.primaryColor || null,
      logoFileId: settings.branding.logoFileId,
      logoFileName: settings.branding.logoFileName,
      logoMimeType: settings.branding.logoMimeType,
      logoUrl: "/api/workspace/branding/logo"
    },
    setup
  };
};

const deleteLogo = async (tenantId) => {
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
  return {
    branding: {
      supportDisplayName: settings.branding.supportDisplayName || "",
      primaryColor: settings.branding.primaryColor || null,
      logoFileId: null,
      logoFileName: null,
      logoMimeType: null,
      logoUrl: null
    },
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

module.exports = {
  getSettings,
  getSetupStatus,
  getPublicBranding,
  updateOrganization,
  updateBranding,
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
