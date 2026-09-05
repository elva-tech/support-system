const asyncHandler = require("../utils/asyncHandler");
const {
  resolveTenantFromRequest
} = require("../../modules/tenants/tenant-resolver.service");
const { tenantContextRequired, tenantAccessDenied } = require("../../modules/tenants/tenant.errors");
const { idsEqual } = require("../../modules/tenants/tenant-resolver.service");

/**
 * Attempt tenant resolution. Continues without req.tenant when none applies.
 * Invalid/reserved/inactive candidates still fail the request.
 */
const optionalTenantContext = asyncHandler(async (req, _res, next) => {
  req.tenant = await resolveTenantFromRequest(req, { required: false });
  next();
});

/**
 * Require a resolved operable tenant on the request.
 */
const requireTenantContext = asyncHandler(async (req, _res, next) => {
  if (req.tenant?._id) {
    return next();
  }
  req.tenant = await resolveTenantFromRequest(req, { required: true });
  if (!req.tenant?._id) {
    throw tenantContextRequired();
  }
  next();
});

/**
 * Staff membership: authenticated user's tenantId must match req.tenant.
 * Must run after authenticate + requireTenantContext.
 * No platform-admin cross-tenant bypass.
 */
const requireTenantMembership = (req, _res, next) => {
  if (!req.tenant?._id) {
    return next(tenantContextRequired());
  }
  if (!req.user) {
    return next(tenantAccessDenied());
  }

  if (!idsEqual(req.user.tenantId, req.tenant._id)) {
    return next(tenantAccessDenied());
  }

  next();
};

/**
 * Merchant membership: merchant profile tenantId must match req.tenant.
 * Must run after merchantAuthenticate + requireTenantContext.
 */
const requireMerchantTenantMembership = (req, _res, next) => {
  if (!req.tenant?._id) {
    return next(tenantContextRequired());
  }
  if (!req.merchant) {
    return next(tenantAccessDenied());
  }

  if (!idsEqual(req.merchant.tenantId, req.tenant._id)) {
    return next(tenantAccessDenied());
  }

  next();
};

/**
 * Convenience chain for staff tenant workspace APIs:
 * authenticate → requireTenantContext → requireTenantMembership
 * (authenticate must already be applied, or compose separately)
 */
const staffTenantGuards = [requireTenantContext, requireTenantMembership];
const merchantTenantGuards = [requireTenantContext, requireMerchantTenantMembership];

module.exports = {
  optionalTenantContext,
  requireTenantContext,
  requireTenantMembership,
  requireMerchantTenantMembership,
  staffTenantGuards,
  merchantTenantGuards
};
