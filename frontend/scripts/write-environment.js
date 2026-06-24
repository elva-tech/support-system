/**
 * Injects API_URL into the production environment before ng build.
 * Used on Vercel (and other CI) — local dev uses environment.ts via ng serve.
 *
 * Vercel: set API_URL=https://your-api.onrender.com/api
 * Docker/nginx: omit API_URL (defaults to same-origin /api proxy)
 */
const fs = require('fs');
const path = require('path');

const apiUrl = process.env.API_URL;

if (!apiUrl) {
  console.log('API_URL not set — using committed src/environments/environment.prod.ts');
  process.exit(0);
}

const normalized = apiUrl.replace(/\/$/, '');
const outPath = path.join(__dirname, '../src/environments/environment.prod.ts');
const content = `export const environment = {
  production: true,
  apiUrl: '${normalized.replace(/'/g, "\\'")}'
};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath} with apiUrl: ${normalized}`);
