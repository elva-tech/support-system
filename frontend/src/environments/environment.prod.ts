export const environment = {
  production: true,
  /**
   * Deterministic API base URL (Option B). Injected at build time via API_URL.
   * Must NOT be derived from the browser hostname (avoids tenant.api… mistakes).
   * Example: https://api.elvasupport.in/api
   */
  apiUrl: 'https://support-system-qhjr.onrender.com/api',
  tenantBaseDomain: 'elvasupport.in',
  platformAdminHost: 'admin.elvasupport.in',
  developmentTenantSlug: '',
  portalMode: 'auto' as 'auto' | 'platform' | 'tenant',
  sendTenantSlugHeader: false
};
