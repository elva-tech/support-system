/**
 * Strip client-supplied tenantId from input objects (never trust the client).
 */
const stripClientTenantId = (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const { tenantId: _ignored, ...rest } = payload;
  return rest;
};

/**
 * Build a scoped Mongo filter that always includes tenantId when provided.
 */
const withTenantFilter = (tenantId, filter = {}) => {
  if (!tenantId) {
    throw new Error("tenantId is required for tenant-scoped queries");
  }
  return { ...filter, tenantId };
};

module.exports = {
  stripClientTenantId,
  withTenantFilter
};
