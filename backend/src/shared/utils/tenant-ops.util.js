const Ticket = require("../../modules/tickets/ticket.model");
const Tenant = require("../../modules/tenants/tenant.model");
const { OPERABLE_TENANT_STATUSES } = require("../constants/tenant");
const { idsEqual } = require("../../modules/tenants/tenant-resolver.service");

const toIdString = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  return value.toString();
};

/**
 * Resolve tenantId from a ticket document or ticket id.
 * Preferred source of truth for background / email workers.
 */
const resolveTenantIdFromTicket = async (ticketOrId) => {
  if (!ticketOrId) {
    return null;
  }

  if (typeof ticketOrId === "object" && ticketOrId.tenantId) {
    return ticketOrId.tenantId;
  }

  const id = toIdString(ticketOrId);
  if (!id) {
    return null;
  }

  const ticket = await Ticket.findById(id).select("tenantId").lean();
  return ticket?.tenantId || null;
};

const loadTenantById = async (tenantId) => {
  if (!tenantId) {
    return null;
  }
  return Tenant.findById(tenantId).lean();
};

const isTenantOperable = (tenant) => {
  if (!tenant) {
    return false;
  }
  return OPERABLE_TENANT_STATUSES.includes(tenant.status);
};

/**
 * Branding context for outbound email templates.
 * Physical mailbox stays central; display name may reflect the tenant.
 * Prefers tenant.settings.branding.supportDisplayName when configured.
 * Never throws — missing branding falls back to ELVA defaults.
 */
const buildEmailBranding = (tenant = null) => {
  const {
    ELVA_DEFAULT_BRANDING,
    normalizeHexColor
  } = require("../constants/default-branding");
  const { buildWorkspaceUrl } = require("../../modules/tenant-provisioning/invitation-token.util");

  const tenantName = tenant?.name || ELVA_DEFAULT_BRANDING.organizationName;
  const brandingSettings =
    tenant?.settings?.branding && typeof tenant.settings.branding === "object"
      ? tenant.settings.branding
      : {};

  const configuredDisplay =
    typeof brandingSettings.supportDisplayName === "string"
      ? brandingSettings.supportDisplayName.trim()
      : "";

  let supportDisplayName = configuredDisplay;
  if (!supportDisplayName) {
    supportDisplayName =
      tenant?.slug && tenant.slug !== "elva"
        ? `${tenantName} Support`
        : ELVA_DEFAULT_BRANDING.supportDisplayName;
  }

  const primaryColor =
    normalizeHexColor(brandingSettings.primaryColor) || ELVA_DEFAULT_BRANDING.primaryColor;
  const secondaryColor =
    normalizeHexColor(brandingSettings.secondaryColor) || ELVA_DEFAULT_BRANDING.secondaryColor;

  const logoFileId = brandingSettings.logoFileId || null;
  let logoUrl = null;
  if (logoFileId && tenant?.slug) {
    try {
      logoUrl = `${buildWorkspaceUrl(tenant.slug)}/api/workspace/branding/logo`;
    } catch {
      logoUrl = null;
    }
  }

  const organizationName =
    (tenant?.settings?.organization &&
      (tenant.settings.organization.displayName || tenant.settings.organization.name)) ||
    tenantName;

  return {
    tenantId: tenant?._id || null,
    tenantSlug: tenant?.slug || "elva",
    tenantName,
    organizationName,
    supportDisplayName,
    logoFileId,
    logoUrl,
    primaryColor,
    secondaryColor,
    branding: {
      supportDisplayName,
      tenantName,
      organizationName,
      logoFileId,
      logoUrl,
      primaryColor,
      secondaryColor
    }
  };
};

/**
 * Storage folder key for tenant branding assets.
 * Pattern: {tenantSlug}/branding
 */
const buildBrandingStorageFolder = (tenantSlug) => {
  const slug = String(tenantSlug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  if (!slug) {
    throw new Error("tenantSlug is required for branding storage");
  }
  return `${slug}/branding`;
};

/**
 * Storage folder key for ticket attachments.
 * New: {tenantSlug}/tickets/{ticketNumber}
 * Legacy reads still check {ticketNumber}/
 */
const buildTicketStorageFolder = ({ tenantSlug, ticketNumber }) => {
  const number = String(ticketNumber || "").trim();
  const slug = String(tenantSlug || "").trim().toLowerCase();
  if (slug && number) {
    return `${slug}/tickets/${number}`;
  }
  return number;
};

const assertSameTenant = (left, right) => {
  if (!left || !right) {
    return false;
  }
  return idsEqual(left, right);
};

module.exports = {
  toIdString,
  resolveTenantIdFromTicket,
  loadTenantById,
  isTenantOperable,
  buildEmailBranding,
  buildTicketStorageFolder,
  buildBrandingStorageFolder,
  assertSameTenant
};
