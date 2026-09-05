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
 */
const buildEmailBranding = (tenant = null) => {
  const tenantName = tenant?.name || "ELVA Technologies";
  const supportDisplayName =
    tenant?.slug && tenant.slug !== "elva"
      ? `${tenantName} Support`
      : "ELVA Support";

  return {
    tenantId: tenant?._id || null,
    tenantSlug: tenant?.slug || "elva",
    tenantName,
    supportDisplayName,
    branding: {
      supportDisplayName,
      tenantName
    }
  };
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
  assertSameTenant
};
