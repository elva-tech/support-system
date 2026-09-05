/**
 * Phase 7 portal-host verification (no Angular test runner in this project).
 * Mirrors frontend/src/app/core/portal/portal-host.util.ts rules.
 *
 * Run: node scripts/verify-portal-host.mjs
 */

const RESERVED = new Set([
  'admin',
  'www',
  'api',
  'mail',
  'support',
  'app',
  'portal',
  'static',
  'assets'
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const resolve = (rawHost, config) => {
  const hostname = String(rawHost || '')
    .trim()
    .toLowerCase()
    .split(':')[0];
  const baseDomain = config.tenantBaseDomain.toLowerCase().trim();
  const platformHost = config.platformAdminHost.toLowerCase().trim();
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost');

  if (hostname === platformHost || hostname === `admin.${baseDomain}`) {
    return { portalType: 'PLATFORM', tenantSlug: null };
  }

  if (isLocalhost) {
    if (config.portalMode === 'platform') {
      return { portalType: 'PLATFORM', tenantSlug: null };
    }
    const slug = (config.developmentTenantSlug || 'elva').toLowerCase();
    if (RESERVED.has(slug) || !SLUG_RE.test(slug)) {
      return { portalType: 'UNKNOWN', tenantSlug: null };
    }
    return { portalType: 'TENANT', tenantSlug: slug };
  }

  if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));
    if (!subdomain || subdomain.includes('.')) {
      return { portalType: 'UNKNOWN', tenantSlug: null };
    }
    if (RESERVED.has(subdomain)) {
      if (subdomain === 'admin') {
        return { portalType: 'PLATFORM', tenantSlug: null };
      }
      return { portalType: 'UNKNOWN', tenantSlug: null };
    }
    if (!SLUG_RE.test(subdomain)) {
      return { portalType: 'UNKNOWN', tenantSlug: null };
    }
    return { portalType: 'TENANT', tenantSlug: subdomain };
  }

  return { portalType: 'UNKNOWN', tenantSlug: null };
};

const base = {
  tenantBaseDomain: 'elvasupport.in',
  platformAdminHost: 'admin.elvasupport.in',
  developmentTenantSlug: 'elva',
  portalMode: 'auto',
  production: false
};

const cases = [
  ['admin.elvasupport.in', base, 'PLATFORM', null],
  ['elva.elvasupport.in', base, 'TENANT', 'elva'],
  ['abc.elvasupport.in', base, 'TENANT', 'abc'],
  ['www.elvasupport.in', base, 'UNKNOWN', null],
  ['api.elvasupport.in', base, 'UNKNOWN', null],
  ['localhost', base, 'TENANT', 'elva'],
  ['localhost', { ...base, portalMode: 'platform' }, 'PLATFORM', null],
  ['127.0.0.1', base, 'TENANT', 'elva'],
  ['evil.com', base, 'UNKNOWN', null]
];

let failed = 0;
for (const [host, cfg, expectType, expectSlug] of cases) {
  const got = resolve(host, cfg);
  const ok = got.portalType === expectType && got.tenantSlug === expectSlug;
  if (!ok) {
    failed += 1;
    console.error('FAIL', host, 'expected', expectType, expectSlug, 'got', got);
  } else {
    console.log('OK  ', host, '→', got.portalType, got.tenantSlug);
  }
}

// Token path helpers
const isPlatformApi = (url) => /\/api\/platform(\/|$|\?)/.test(url);
const isMerchantApi = (url) => /\/api\/merchant(\/|$|\?)/.test(url);
const apiCases = [
  ['http://localhost:3000/api/platform/tenants', true, false],
  ['http://localhost:3000/api/auth/login', false, false],
  ['http://localhost:3000/api/merchant/request-otp', false, true]
];
for (const [url, plat, merch] of apiCases) {
  const ok = isPlatformApi(url) === plat && isMerchantApi(url) === merch;
  if (!ok) {
    failed += 1;
    console.error('FAIL api path', url);
  } else {
    console.log('OK   api path', url);
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll portal-host verification checks passed');
