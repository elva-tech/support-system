const Tenant = require("./tenant.model");
const {
  DEFAULT_TENANT_STATUS,
  ELVA_TENANT_SEED,
  TENANT_STATUSES
} = require("../../shared/constants/tenant");
const { defaultWorkspaceSetup } = require("../../shared/constants/workspace-setup");
const {
  assertValidTenantName,
  assertValidTenantSlug,
  assertValidTenantStatus,
  normalizeTenantSlug
} = require("./tenant.validation");
const {
  tenantNotFound,
  tenantSlugAlreadyExists
} = require("./tenant.errors");

const defaultSettings = () => ({
  organization: {},
  branding: {},
  notifications: {}
});

/**
 * Create a tenant. Slug is normalized to lowercase before validation.
 * Reserved and invalid slugs are rejected. Duplicate slugs → 409.
 */
const create = async ({ name, slug, status = DEFAULT_TENANT_STATUS, settings, setup } = {}) => {
  const normalizedName = assertValidTenantName(name);
  const normalizedSlug = assertValidTenantSlug(slug);
  assertValidTenantStatus(status);

  const existing = await Tenant.findOne({ slug: normalizedSlug });
  if (existing) {
    throw tenantSlugAlreadyExists(normalizedSlug);
  }

  try {
    return await Tenant.create({
      name: normalizedName,
      slug: normalizedSlug,
      status,
      settings: settings || defaultSettings(),
      setup: setup || defaultWorkspaceSetup()
    });
  } catch (error) {
    if (error && error.code === 11000) {
      throw tenantSlugAlreadyExists(normalizedSlug);
    }
    throw error;
  }
};

const getById = async (id) => {
  const tenant = await Tenant.findById(id);
  if (!tenant) {
    throw tenantNotFound();
  }
  return tenant;
};

const getBySlug = async (rawSlug) => {
  const slug = normalizeTenantSlug(rawSlug);
  const tenant = await Tenant.findOne({ slug });
  if (!tenant) {
    throw tenantNotFound(`Tenant not found for slug: ${slug || "(empty)"}`);
  }
  return tenant;
};

/**
 * Soft lookup — returns null when missing (useful for seed/idempotency checks).
 */
const findBySlug = async (rawSlug) => {
  const slug = normalizeTenantSlug(rawSlug);
  if (!slug) {
    return null;
  }
  return Tenant.findOne({ slug });
};

const list = async (filters = {}) => {
  const query = {};
  if (filters.status) {
    assertValidTenantStatus(filters.status);
    query.status = filters.status;
  }
  return Tenant.find(query).sort({ name: 1 });
};

const updateStatus = async (id, status) => {
  assertValidTenantStatus(status);
  const tenant = await getById(id);
  tenant.status = status;
  await tenant.save();
  return tenant;
};

/**
 * Idempotent ELVA Technologies seed used by migrations and tests.
 * Lookup key: slug "elva". Does not modify an existing ELVA tenant's name/status.
 */
const ensureElvaTenant = async () => {
  const existing = await findBySlug(ELVA_TENANT_SEED.slug);
  if (existing) {
    return { tenant: existing, created: false };
  }

  const tenant = await create({
    name: ELVA_TENANT_SEED.name,
    slug: ELVA_TENANT_SEED.slug,
    status: ELVA_TENANT_SEED.status || TENANT_STATUSES.ACTIVE
  });

  return { tenant, created: true };
};

module.exports = {
  create,
  getById,
  getBySlug,
  findBySlug,
  list,
  updateStatus,
  ensureElvaTenant
};
