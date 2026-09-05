/**
 * Pure hostname → portal / tenant slug resolution (Phase 7).
 * No Angular DI — unit-testable and shared with Node verification script.
 */

export type PortalType = 'PLATFORM' | 'TENANT' | 'UNKNOWN';

export const RESERVED_TENANT_SLUGS = Object.freeze([
  'admin',
  'www',
  'api',
  'mail',
  'smtp',
  'imap',
  'support',
  'app',
  'portal',
  'static',
  'assets',
  'cdn',
  'status',
  'health',
  'docs',
  'staging',
  'dev',
  'test'
] as const);

export const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PortalHostConfig {
  tenantBaseDomain: string;
  platformAdminHost: string;
  developmentTenantSlug: string;
  /** auto | platform | tenant — local override without DNS */
  portalMode: 'auto' | 'platform' | 'tenant';
  production: boolean;
}

export interface PortalHostResult {
  portalType: PortalType;
  tenantSlug: string | null;
  hostname: string;
  isLocalhost: boolean;
  reason: string;
}

const normalizeHost = (host: string): string =>
  String(host || '')
    .trim()
    .toLowerCase()
    .split(':')[0];

export const isReservedTenantSlug = (slug: string): boolean =>
  (RESERVED_TENANT_SLUGS as readonly string[]).includes(String(slug || '').toLowerCase());

export const isValidTenantSlugFormat = (slug: string): boolean =>
  TENANT_SLUG_PATTERN.test(String(slug || '').toLowerCase());

export const suggestTenantSlug = (name: string): string =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 63);

/**
 * Resolve portal type and tenant slug from a hostname.
 */
export const resolvePortalFromHost = (
  rawHost: string,
  config: PortalHostConfig
): PortalHostResult => {
  const hostname = normalizeHost(rawHost);
  const baseDomain = config.tenantBaseDomain.toLowerCase().trim();
  const platformHost = config.platformAdminHost.toLowerCase().trim();
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost');

  if (!hostname) {
    return {
      portalType: 'UNKNOWN',
      tenantSlug: null,
      hostname,
      isLocalhost: false,
      reason: 'empty-host'
    };
  }

  if (hostname === platformHost || hostname === `admin.${baseDomain}`) {
    return {
      portalType: 'PLATFORM',
      tenantSlug: null,
      hostname,
      isLocalhost,
      reason: 'platform-admin-host'
    };
  }

  if (isLocalhost) {
    if (config.portalMode === 'platform') {
      return {
        portalType: 'PLATFORM',
        tenantSlug: null,
        hostname,
        isLocalhost: true,
        reason: 'local-portal-mode-platform'
      };
    }

    const slug = (config.developmentTenantSlug || 'elva').toLowerCase().trim();
    if (isReservedTenantSlug(slug) || !isValidTenantSlugFormat(slug)) {
      return {
        portalType: 'UNKNOWN',
        tenantSlug: null,
        hostname,
        isLocalhost: true,
        reason: 'invalid-dev-tenant-slug'
      };
    }

    return {
      portalType: 'TENANT',
      tenantSlug: slug,
      hostname,
      isLocalhost: true,
      reason: 'local-dev-tenant-fallback'
    };
  }

  // {slug}.{baseDomain}
  if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));
    if (!subdomain || subdomain.includes('.')) {
      return {
        portalType: 'UNKNOWN',
        tenantSlug: null,
        hostname,
        isLocalhost,
        reason: 'invalid-subdomain'
      };
    }

    if (isReservedTenantSlug(subdomain)) {
      if (subdomain === 'admin') {
        return {
          portalType: 'PLATFORM',
          tenantSlug: null,
          hostname,
          isLocalhost,
          reason: 'reserved-admin-subdomain'
        };
      }
      return {
        portalType: 'UNKNOWN',
        tenantSlug: null,
        hostname,
        isLocalhost,
        reason: `reserved-slug:${subdomain}`
      };
    }

    if (!isValidTenantSlugFormat(subdomain)) {
      return {
        portalType: 'UNKNOWN',
        tenantSlug: null,
        hostname,
        isLocalhost,
        reason: 'invalid-slug-format'
      };
    }

    return {
      portalType: 'TENANT',
      tenantSlug: subdomain,
      hostname,
      isLocalhost,
      reason: 'tenant-subdomain'
    };
  }

  return {
    portalType: 'UNKNOWN',
    tenantSlug: null,
    hostname,
    isLocalhost,
    reason: 'unrecognized-host'
  };
};
