/**
 * Portal-host verification (mirrors frontend/src/app/core/portal/portal-host.util.ts).
 *
 * Run: node scripts/verify-portal-host.mjs
 */

const RESERVED = new Set([
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
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const resolve = (rawHost, config) => {
  const hostname = String(rawHost || '')
    .trim()
    .toLowerCase()
    .split(':')[0];
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

  if (hostname === platformHost || hostname === `admin.${baseDomain}`) {
    return { portalType: 'PLATFORM', tenantSlug: null };
  }

  if (hostname === centralSupportHost || hostname === `support.${baseDomain}`) {
    return { portalType: 'CENTRAL_SUPPORT', tenantSlug: null };
  }

  if (baseDomain && (hostname === baseDomain || hostname === `www.${baseDomain}`)) {
    return { portalType: 'APEX', tenantSlug: null };
  }

  if (isLocalhost) {
    if (config.portalMode === 'landing') {
      return { portalType: 'APEX', tenantSlug: null };
    }
    if (config.portalMode === 'platform') {
      return { portalType: 'PLATFORM', tenantSlug: null };
    }
    if (config.portalMode === 'central-support') {
      return { portalType: 'CENTRAL_SUPPORT', tenantSlug: null };
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
      if (subdomain === 'support') {
        return { portalType: 'CENTRAL_SUPPORT', tenantSlug: null };
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
  centralSupportHost: 'support.elvasupport.in',
  developmentTenantSlug: 'elva',
  portalMode: 'auto',
  production: false
};

const cases = [
  ['elvasupport.in', base, 'APEX', null],
  ['www.elvasupport.in', base, 'APEX', null],
  ['admin.elvasupport.in', base, 'PLATFORM', null],
  ['support.elvasupport.in', base, 'CENTRAL_SUPPORT', null],
  ['elva.elvasupport.in', base, 'TENANT', 'elva'],
  ['abc.elvasupport.in', base, 'TENANT', 'abc'],
  ['api.elvasupport.in', base, 'UNKNOWN', null],
  ['localhost', base, 'TENANT', 'elva'],
  ['localhost', { ...base, portalMode: 'platform' }, 'PLATFORM', null],
  ['localhost', { ...base, portalMode: 'landing' }, 'APEX', null],
  ['localhost', { ...base, portalMode: 'central-support' }, 'CENTRAL_SUPPORT', null],
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

const isPlatformApi = (url) => /\/api\/platform(\/|$|\?)/.test(url);
const isMerchantApi = (url) => /\/api\/merchant(\/|$|\?)/.test(url);
const isCentralSupportApi = (url) => /\/api\/central-support(\/|$|\?)/.test(url);
const apiCases = [
  ['http://localhost:3000/api/platform/tenants', true, false, false],
  ['http://localhost:3000/api/auth/login', false, false, false],
  ['http://localhost:3000/api/merchant/request-otp', false, true, false],
  ['http://localhost:3000/api/central-support/tickets', false, false, true]
];
for (const [url, plat, merch, cs] of apiCases) {
  const ok =
    isPlatformApi(url) === plat &&
    isMerchantApi(url) === merch &&
    isCentralSupportApi(url) === cs;
  if (!ok) {
    failed += 1;
    console.error('FAIL api path', url);
  } else {
    console.log('OK   api path', url);
  }
}

/** Mirrors tenant-bootstrap.util.ts */
const classifyBootstrapFailure = (info) => {
  const status = Number(info.status) || 0;
  const code = String(info.code || '').trim();
  const notFound = new Set([
    'TENANT_NOT_FOUND',
    'INVALID_TENANT_HOST',
    'INVALID_TENANT_SLUG',
    'RESERVED_TENANT_SLUG',
    'TENANT_CONTEXT_REQUIRED'
  ]);
  if (status === 404 || notFound.has(code)) return 'not-found';
  return 'error';
};

const bootstrapCases = [
  [{ status: 404 }, 'not-found'],
  [{ status: 400, code: 'TENANT_NOT_FOUND' }, 'not-found'],
  [{ status: 400, code: 'INVALID_TENANT_HOST' }, 'not-found'],
  [{ status: 400, code: 'TENANT_CONTEXT_REQUIRED' }, 'not-found'],
  [{ status: 500 }, 'error'],
  [{ status: 0 }, 'error']
];
for (const [info, expect] of bootstrapCases) {
  const got = classifyBootstrapFailure(info);
  if (got !== expect) {
    failed += 1;
    console.error('FAIL bootstrap', info, 'expected', expect, 'got', got);
  } else {
    console.log('OK   bootstrap', JSON.stringify(info), '→', got);
  }
}

{
  const got = resolve('test.elvasupport.in', base);
  if (got.portalType !== 'UNKNOWN' || got.tenantSlug !== null) {
    failed += 1;
    console.error('FAIL test.elvasupport.in must be UNKNOWN reserved, got', got);
  } else {
    console.log('OK   test.elvasupport.in → UNKNOWN (reserved)');
  }
}
{
  const got = resolve('qwerty.elvasupport.in', base);
  if (got.portalType !== 'TENANT' || got.tenantSlug !== 'qwerty') {
    failed += 1;
    console.error('FAIL qwerty.elvasupport.in must be TENANT, got', got);
  } else {
    console.log('OK   qwerty.elvasupport.in → TENANT qwerty');
  }
}

if (failed) {
  console.error(`\n${failed} verification check(s) failed`);
  process.exit(1);
}
console.log('\nAll portal-host verification checks passed');
