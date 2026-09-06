/**
 * Injects API_URL (and optional portal env) into the production environment before ng build.
 * Used on Vercel (and other CI) — local dev uses environment.ts via ng serve.
 *
 * Vercel: set API_URL=https://your-api.onrender.com/api
 * Optional: TENANT_BASE_DOMAIN, PLATFORM_ADMIN_HOST, CENTRAL_SUPPORT_HOST
 */
const fs = require('fs');
const path = require('path');

const apiUrl = process.env.API_URL;

if (!apiUrl) {
  console.log('API_URL not set — using committed src/environments/environment.prod.ts');
  process.exit(0);
}

let normalized = apiUrl.replace(/\/$/, '');

if (normalized.startsWith('http') && !normalized.endsWith('/api')) {
  normalized = `${normalized}/api`;
  console.warn('API_URL did not end with /api — appended automatically:', normalized);
}

const tenantBaseDomain = (process.env.TENANT_BASE_DOMAIN || 'elvasupport.in').replace(/'/g, "\\'");
const platformAdminHost = (
  process.env.PLATFORM_ADMIN_HOST || `admin.${process.env.TENANT_BASE_DOMAIN || 'elvasupport.in'}`
).replace(/'/g, "\\'");
const centralSupportHost = (
  process.env.CENTRAL_SUPPORT_HOST || `support.${process.env.TENANT_BASE_DOMAIN || 'elvasupport.in'}`
).replace(/'/g, "\\'");

const outPath = path.join(__dirname, '../src/environments/environment.prod.ts');
const content = `export const environment = {
  production: true,
  apiUrl: '${normalized.replace(/'/g, "\\'")}',
  tenantBaseDomain: '${tenantBaseDomain}',
  platformAdminHost: '${platformAdminHost}',
  centralSupportHost: '${centralSupportHost}',
  developmentTenantSlug: '',
  portalMode: 'auto' as 'auto' | 'platform' | 'central-support' | 'tenant' | 'landing',
  sendTenantSlugHeader: false
};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath} with apiUrl: ${normalized}`);
