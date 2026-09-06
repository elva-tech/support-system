export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  /** Apex domain for {slug}.{domain} workspace hosts + public landing */
  tenantBaseDomain: 'elvasupport.in',
  /** Canonical platform admin hostname */
  platformAdminHost: 'admin.elvasupport.in',
  /** Canonical ELVA Central Support hostname */
  centralSupportHost: 'support.elvasupport.in',
  /** Localhost fallback tenant slug (never used in production builds) */
  developmentTenantSlug: 'elva',
  /**
   * Local portal selection without DNS:
   * - auto / tenant → TENANT workspace with developmentTenantSlug
   * - platform → Platform Administration UI on localhost
   * - central-support → ELVA Central Support UI on localhost
   * - landing → Public SaaS landing (apex) on localhost
   */
  portalMode: 'platform' as
    | 'auto'
    | 'platform'
    | 'central-support'
    | 'tenant'
    | 'landing',
  /** Send X-Tenant-Slug in non-production when backend header override is enabled */
  sendTenantSlugHeader: true
};
