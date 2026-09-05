export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  /** Apex domain for {slug}.{domain} workspace hosts */
  tenantBaseDomain: 'elvasupport.in',
  /** Canonical platform admin hostname */
  platformAdminHost: 'admin.elvasupport.in',
  /** Localhost fallback tenant slug (never used in production builds) */
  developmentTenantSlug: 'elva',
  /**
   * Local portal selection without DNS:
   * - auto / tenant → TENANT workspace with developmentTenantSlug
   * - platform → Platform Administration UI on localhost
   */
  portalMode: 'auto' as 'auto' | 'platform' | 'tenant',
  // portalMode: 'platform' as 'auto' | 'platform' | 'tenant',
  /** Send X-Tenant-Slug in non-production when backend header override is enabled */
  sendTenantSlugHeader: true
};
