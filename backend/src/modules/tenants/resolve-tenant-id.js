const Tenant = require("../tenants/tenant.model");
const { ELVA_TENANT_SEED } = require("../../shared/constants/tenant");

/**
 * Resolve tenantId for writes during the Phase 3 transition (before request isolation).
 * Prefer application.tenantId; fall back to the seeded ELVA tenant by slug.
 */
const resolveTenantIdForApplication = async (application) => {
  if (application?.tenantId) {
    return application.tenantId;
  }

  const elva = await Tenant.findOne({ slug: ELVA_TENANT_SEED.slug }).select("_id");
  return elva?._id || null;
};

module.exports = { resolveTenantIdForApplication };
