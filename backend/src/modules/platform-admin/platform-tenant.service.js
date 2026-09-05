const Tenant = require("../tenants/tenant.model");
const tenantService = require("../tenants/tenant.service");
const {
  assertValidTenantName,
  assertValidTenantStatus
} = require("../tenants/tenant.validation");
const { tenantNotFound } = require("../tenants/tenant.errors");
const {
  TENANT_STATUS_TRANSITIONS,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_TARGET_TYPES
} = require("../../shared/constants/platform");
const { TENANT_STATUSES } = require("../../shared/constants/tenant");
const { invalidTenantStatusTransition } = require("./platform-admin.errors");
const { logPlatformAudit } = require("./platform-audit.service");

const toPublicTenant = (tenant) => {
  if (!tenant) {
    return null;
  }
  const obj = typeof tenant.toObject === "function" ? tenant.toObject() : { ...tenant };
  return {
    id: String(obj._id),
    name: obj.name,
    slug: obj.slug,
    status: obj.status,
    settings: obj.settings || { organization: {}, branding: {}, notifications: {} },
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

const createTenant = async ({ name, slug, status, settings }, { actor } = {}) => {
  const tenant = await tenantService.create({ name, slug, status, settings });

  if (actor) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_CREATED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.TENANT,
      targetId: tenant._id,
      metadata: { slug: tenant.slug, status: tenant.status, name: tenant.name }
    });
  }

  return toPublicTenant(tenant);
};

const listTenants = async ({ status, search, slug, name, limit = 50, skip = 0 } = {}) => {
  const query = {};

  if (status) {
    assertValidTenantStatus(status);
    query.status = status;
  }
  if (slug) {
    query.slug = String(slug).trim().toLowerCase();
  }
  if (name) {
    query.name = { $regex: String(name).trim(), $options: "i" };
  }
  if (search) {
    const term = String(search).trim();
    if (term) {
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { slug: { $regex: term, $options: "i" } }
      ];
    }
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeSkip = Math.max(parseInt(skip, 10) || 0, 0);

  const [items, total] = await Promise.all([
    Tenant.find(query).sort({ createdAt: -1 }).skip(safeSkip).limit(safeLimit),
    Tenant.countDocuments(query)
  ]);

  return {
    items: items.map(toPublicTenant),
    total,
    limit: safeLimit,
    skip: safeSkip
  };
};

const getTenant = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw tenantNotFound();
  }
  return toPublicTenant(tenant);
};

/**
 * Controlled update. Slug is immutable through this path.
 * Allowed: name, settings.organization | branding | notifications.
 */
const updateTenant = async (tenantId, payload, { actor } = {}) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw tenantNotFound();
  }

  const changed = [];

  if (payload.name !== undefined) {
    tenant.name = assertValidTenantName(payload.name);
    changed.push("name");
  }

  if (payload.settings && typeof payload.settings === "object") {
    const current = tenant.settings?.toObject
      ? tenant.settings.toObject()
      : { ...(tenant.settings || {}) };

    if (payload.settings.organization !== undefined) {
      current.organization =
        payload.settings.organization && typeof payload.settings.organization === "object"
          ? payload.settings.organization
          : {};
      changed.push("settings.organization");
    }
    if (payload.settings.branding !== undefined) {
      current.branding =
        payload.settings.branding && typeof payload.settings.branding === "object"
          ? payload.settings.branding
          : {};
      changed.push("settings.branding");
    }
    if (payload.settings.notifications !== undefined) {
      current.notifications =
        payload.settings.notifications && typeof payload.settings.notifications === "object"
          ? payload.settings.notifications
          : {};
      changed.push("settings.notifications");
    }

    tenant.settings = current;
  }

  // Explicitly ignore slug / status on PATCH (lifecycle endpoints handle status)
  await tenant.save();

  if (actor && changed.length) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action: PLATFORM_AUDIT_ACTIONS.TENANT_UPDATED,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.TENANT,
      targetId: tenant._id,
      metadata: { fields: changed, slug: tenant.slug }
    });
  }

  return toPublicTenant(tenant);
};

const assertTransitionAllowed = (from, to) => {
  const allowed = TENANT_STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw invalidTenantStatusTransition(from, to);
  }
};

const transitionTenantStatus = async (tenantId, nextStatus, { actor } = {}) => {
  assertValidTenantStatus(nextStatus);
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw tenantNotFound();
  }

  const previous = tenant.status;
  if (previous === nextStatus) {
    return toPublicTenant(tenant);
  }

  assertTransitionAllowed(previous, nextStatus);
  tenant.status = nextStatus;
  await tenant.save();

  let action = PLATFORM_AUDIT_ACTIONS.TENANT_STATUS_CHANGED;
  if (nextStatus === TENANT_STATUSES.SUSPENDED) {
    action = PLATFORM_AUDIT_ACTIONS.TENANT_SUSPENDED;
  } else if (
    nextStatus === TENANT_STATUSES.ACTIVE ||
    (previous === TENANT_STATUSES.SUSPENDED && nextStatus === TENANT_STATUSES.ACTIVE)
  ) {
    action = PLATFORM_AUDIT_ACTIONS.TENANT_ACTIVATED;
  } else if (nextStatus === TENANT_STATUSES.ARCHIVED) {
    action = PLATFORM_AUDIT_ACTIONS.TENANT_ARCHIVED;
  }

  if (actor) {
    await logPlatformAudit({
      actorPlatformAdminId: actor._id,
      actorEmail: actor.email,
      action,
      targetType: PLATFORM_AUDIT_TARGET_TYPES.TENANT,
      targetId: tenant._id,
      metadata: { from: previous, to: nextStatus, slug: tenant.slug }
    });
  }

  return toPublicTenant(tenant);
};

const activateTenant = (tenantId, ctx) =>
  transitionTenantStatus(tenantId, TENANT_STATUSES.ACTIVE, ctx);

const suspendTenant = (tenantId, ctx) =>
  transitionTenantStatus(tenantId, TENANT_STATUSES.SUSPENDED, ctx);

const cancelTenant = (tenantId, ctx) =>
  transitionTenantStatus(tenantId, TENANT_STATUSES.CANCELLED, ctx);

const archiveTenant = (tenantId, ctx) =>
  transitionTenantStatus(tenantId, TENANT_STATUSES.ARCHIVED, ctx);

module.exports = {
  toPublicTenant,
  createTenant,
  listTenants,
  getTenant,
  updateTenant,
  transitionTenantStatus,
  activateTenant,
  suspendTenant,
  cancelTenant,
  archiveTenant,
  assertTransitionAllowed
};
