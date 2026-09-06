/**
 * Pure hostname → portal / tenant slug resolution.
 * No Angular DI — unit-testable and shared with Node verification script.
 *
 * Host contexts:
 * - APEX              → elvasupport.in / www.elvasupport.in (public SaaS landing)
 * - PLATFORM          → admin.elvasupport.in
 * - CENTRAL_SUPPORT   → support.elvasupport.in
 * - TENANT            → {slug}.elvasupport.in
 * - UNKNOWN           → reserved/invalid/unrecognized hosts
 */

export type PortalType = 'APEX' | 'PLATFORM' | 'CENTRAL_SUPPORT' | 'TENANT' | 'UNKNOWN';

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

export type PortalMode = 'auto' | 'platform' | 'central-support' | 'tenant' | 'landing';

export interface PortalHostConfig {
  tenantBaseDomain: string;
  platformAdminHost: string;
  /** Canonical central support hostname, e.g. support.elvasupport.in */
  centralSupportHost: string;
  developmentTenantSlug: string;
  /** Local override without DNS */
  portalMode: PortalMode;
  production: boolean;
}

export interface PortalHostResult {
  portalType: PortalType;
  tenantSlug: string | null;
  hostname: string;
  isLocalhost: boolean;
  reason: string;
}

export interface HostContext {
  type: 'apex' | 'admin' | 'central-support' | 'tenant' | 'unknown';
  tenantSlug?: string;
  hostname: string;
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
  const centralSupportHost = (
    config.centralSupportHost || `support.${baseDomain}`
  )
    .toLowerCase()
    .trim();
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

  if (hostname === centralSupportHost || hostname === `support.${baseDomain}`) {
    return {
      portalType: 'CENTRAL_SUPPORT',
      tenantSlug: null,
      hostname,
      isLocalhost,
      reason: 'central-support-host'
    };
  }

  // Public SaaS landing: apex + www
  if (baseDomain && (hostname === baseDomain || hostname === `www.${baseDomain}`)) {
    return {
      portalType: 'APEX',
      tenantSlug: null,
      hostname,
      isLocalhost,
      reason: hostname.startsWith('www.') ? 'www-apex-landing' : 'apex-landing'
    };
  }

  if (isLocalhost) {
    if (config.portalMode === 'landing') {
      return {
        portalType: 'APEX',
        tenantSlug: null,
        hostname,
        isLocalhost: true,
        reason: 'local-portal-mode-landing'
      };
    }

    if (config.portalMode === 'platform') {
      return {
        portalType: 'PLATFORM',
        tenantSlug: null,
        hostname,
        isLocalhost: true,
        reason: 'local-portal-mode-platform'
      };
    }

    if (config.portalMode === 'central-support') {
      return {
        portalType: 'CENTRAL_SUPPORT',
        tenantSlug: null,
        hostname,
        isLocalhost: true,
        reason: 'local-portal-mode-central-support'
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
      if (subdomain === 'support') {
        return {
          portalType: 'CENTRAL_SUPPORT',
          tenantSlug: null,
          hostname,
          isLocalhost,
          reason: 'reserved-support-subdomain'
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

export const getHostContext = (rawHost: string, config: PortalHostConfig): HostContext => {
  const resolved = resolvePortalFromHost(rawHost, config);
  if (resolved.portalType === 'APEX') {
    return { type: 'apex', hostname: resolved.hostname, reason: resolved.reason };
  }
  if (resolved.portalType === 'PLATFORM') {
    return { type: 'admin', hostname: resolved.hostname, reason: resolved.reason };
  }
  if (resolved.portalType === 'CENTRAL_SUPPORT') {
    return { type: 'central-support', hostname: resolved.hostname, reason: resolved.reason };
  }
  if (resolved.portalType === 'TENANT') {
    return {
      type: 'tenant',
      tenantSlug: resolved.tenantSlug || undefined,
      hostname: resolved.hostname,
      reason: resolved.reason
    };
  }
  return { type: 'unknown', hostname: resolved.hostname, reason: resolved.reason };
};

export const buildPlatformOrigin = (config: Pick<PortalHostConfig, 'platformAdminHost'>): string => {
  const host = config.platformAdminHost.toLowerCase().trim();
  return `https://${host}`;
};

export const buildCentralSupportOrigin = (
  config: Pick<PortalHostConfig, 'centralSupportHost' | 'tenantBaseDomain'>
): string => {
  const host = (config.centralSupportHost || `support.${config.tenantBaseDomain}`)
    .toLowerCase()
    .trim();
  return `https://${host}`;
};

export const buildApexOrigin = (config: Pick<PortalHostConfig, 'tenantBaseDomain'>): string => {
  const host = config.tenantBaseDomain.toLowerCase().trim();
  return `https://${host}`;
};

export const buildTenantOrigin = (
  slug: string,
  config: Pick<PortalHostConfig, 'tenantBaseDomain'>
): string => {
  const base = config.tenantBaseDomain.toLowerCase().trim();
  return `https://${String(slug).toLowerCase()}.${base}`;
};
