const ApiError = require("../../shared/utils/ApiError");
const { TENANT_ERROR_CODES } = require("../../shared/constants/tenant");

const tenantError = (statusCode, code, message) =>
  new ApiError(statusCode, message, { code });

const tenantNotFound = (detail = "Tenant not found") =>
  tenantError(404, TENANT_ERROR_CODES.TENANT_NOT_FOUND, detail);

const tenantSlugAlreadyExists = (slug) =>
  tenantError(
    409,
    TENANT_ERROR_CODES.TENANT_SLUG_ALREADY_EXISTS,
    `Tenant slug already exists: ${slug}`
  );

const invalidTenantSlug = (detail = "Invalid tenant slug") =>
  tenantError(400, TENANT_ERROR_CODES.INVALID_TENANT_SLUG, detail);

const reservedTenantSlug = (slug) =>
  tenantError(
    400,
    TENANT_ERROR_CODES.RESERVED_TENANT_SLUG,
    `Tenant slug is reserved: ${slug}`
  );

const invalidTenantStatus = (status) =>
  tenantError(
    400,
    TENANT_ERROR_CODES.INVALID_TENANT_STATUS,
    `Invalid tenant status: ${status}`
  );

const invalidTenantName = (detail = "Invalid tenant name") =>
  tenantError(400, TENANT_ERROR_CODES.INVALID_TENANT_NAME, detail);

module.exports = {
  tenantError,
  tenantNotFound,
  tenantSlugAlreadyExists,
  invalidTenantSlug,
  reservedTenantSlug,
  invalidTenantStatus,
  invalidTenantName
};
