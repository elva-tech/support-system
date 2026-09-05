# Phase 13 — Production Readiness, DNS, Subdomain Deployment & Environment Hardening

## 1. Executive Summary

Phase 13 hardens ELVA Support for production wildcard subdomain deployment without changing the multi-tenant application architecture. It adds trusted-proxy configuration, safer hostname extraction, CORS subdomain matching, Origin-based resolution for dedicated API hosts, liveness/readiness probes, production env validation, deployment templates, and verification tooling.

**No database migration is required.**

## 2. Production Architecture

```
Internet
  ↓ HTTPS / TLS termination (wildcard *.elvasupport.in)
Reverse Proxy / Load Balancer (Nginx, ALB, Cloudflare, Render)
  ↓
Frontend (single Angular build)     Backend (Express API)
  admin.elvasupport.in              /health, /health/ready
  {slug}.elvasupport.in             /api/*
  api.elvasupport.in (optional)
```

Platform and tenant UIs share one frontend build. Portal selection is hostname-driven (Phase 7).

## 3. Domain and Hostname Model

| Host | Classification | Behavior |
|------|----------------|----------|
| `admin.elvasupport.in` | PLATFORM | Platform portal; never a tenant |
| `{slug}.elvasupport.in` | TENANT | Tenant workspace when slug exists |
| `api.elvasupport.in` | RESERVED | API host only |
| `www`, `smtp`, `imap`, `cdn`, … | RESERVED | Not tenants |
| `foo.bar.elvasupport.in` | INVALID | Multi-level rejected |
| `localhost` | LOCAL | Dev portal mode / default slug |

Exact rule: only a **single DNS label** under `TENANT_BASE_DOMAIN` may be a tenant.

## 4. Wildcard DNS Requirements

Documented (not applied by this phase):

```
A/CNAME  admin.elvasupport.in  → load balancer
A/CNAME  *.elvasupport.in      → load balancer
A/CNAME  api.elvasupport.in    → load balancer (if Option B)
```

## 5. TLS Requirements

Terminate TLS at the proxy/CDN. Certificate should cover `*.elvasupport.in` (and apex/admin as required by the issuer). Node does not manage certificates.

## 6. Reverse Proxy / Trusted Proxy

`TRUST_PROXY` (default `false`):

- `false` — use `Host` only; ignore `X-Forwarded-Host` (safest without a known proxy)
- `1` / `true` — trust one hop (Nginx, ALB, Cloudflare, Render)

When enabled, Express `trust proxy` is set and hostname extraction prefers Express `req.hostname`.

**Security:** Never enable trust proxy on a publicly reachable Node port without a real reverse proxy in front.

Template: `deployment/nginx.elvasupport.example.conf`

## 7. Tenant Host Resolution

Priority:

1. `X-Tenant-Slug` — **dev/test only**; rejected in production
2. Request `Host` → `{slug}.{TENANT_BASE_DOMAIN}`
3. Browser `Origin` when Host is API/reserved/external (**Option B**)
4. `TENANT_DEV_DEFAULT_SLUG` — **never in production**

Origin never overrides a concrete tenant Host.

## 8. Platform Host Resolution

`admin.{TENANT_BASE_DOMAIN}` / `PLATFORM_ADMIN_HOST` → platform portal. Tenant APIs reject these hosts (`INVALID_TENANT_HOST`).

## 9. Unknown Host Behavior

- Backend: unknown slug → `404 TENANT_NOT_FOUND` (no ELVA fallback)
- Frontend: branding 404 → “Workspace unavailable” (no ELVA identity pretend)
- Invalid/reserved portal hosts → Invalid Portal page

## 10. CORS Policy

- Exact allowlist: `CORS_ALLOWED_ORIGINS` (alias `CORS_ORIGIN`)
- Safe tenant matching when `CORS_ALLOW_TENANT_SUBDOMAINS=true`:
  - `https://admin.{base}`
  - `https://{slug}.{base}` (single label, valid slug)
- Rejects `evil-elvasupport.in`, `elvasupport.in.attacker.com`, multi-level hosts
- `credentials: true`
- No `origin: *`

## 11. Security Headers

Helmet enabled with:

- `referrerPolicy: no-referrer`
- `contentSecurityPolicy: false` (avoid breaking Angular SPA / logos / API)
- `crossOriginEmbedderPolicy: false`

Documented intentional relaxation for SPA compatibility.

## 12. Frontend Deployment Model

One production build serves all hosts. Configure at build time:

```bash
API_URL=https://api.elvasupport.in/api
TENANT_BASE_DOMAIN=elvasupport.in
PLATFORM_ADMIN_HOST=admin.elvasupport.in
npm run build
```

`write-environment.js` injects `environment.prod.ts`.

## 13. API Base URL Strategy

**Deterministic** `API_URL` / `environment.apiUrl` — never derived from `window.location` (prevents `tenant.api…` mistakes).

| Option | Description |
|--------|-------------|
| **A (preferred)** | Proxy `/api` on portal hosts → backend sees tenant `Host` |
| **B** | Dedicated `api.elvasupport.in`; browser `Origin` supplies tenant host |

## 14. Health and Readiness

| Endpoint | Purpose | Success |
|----------|---------|---------|
| `GET /health` | Liveness | `{ "status": "ok" }` |
| `GET /health/ready` | MongoDB ready | `{ "status": "ready" }` or 503 |
| `GET /health/detail` | Legacy detailed | ops only |

## 15. Environment Variables

See `backend/.env.example` for Phase 13 additions:

`TRUST_PROXY`, `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_TENANT_SUBDOMAINS`, `CORS_ALLOW_LOCALHOST`, `ENSURE_ADMIN_ON_STARTUP`, `PLATFORM_ADMIN_HOST`, …

Production validation requires `MONGODB_URI`, `JWT_SECRET`, `INTERNAL_API_KEY`, `TENANT_BASE_DOMAIN`, CORS allowlist; rejects `TENANT_HEADER_OVERRIDE_ENABLED=true` and `TENANT_DEV_DEFAULT_SLUG`.

## 16. Migration / Startup Order

1. Backup database  
2. Deploy application version  
3. Run migrations intentionally (`npm run migrate:up`) — **not** on API start  
4. Verify `migrate:status`  
5. Roll/restart API instances  
6. Verify `/health` and `/health/ready`  
7. Bootstrap platform admin only via `npm run ensure:platform-admin` when needed  

API start: validate env → connect DB → optional `ENSURE_ADMIN_ON_STARTUP` (off in production by default) → workers → listen.  
Migrations / platform-admin / seeds do **not** auto-run.

## 17. Deployment Checklist

### DNS
- [ ] `admin.elvasupport.in`
- [ ] `*.elvasupport.in`
- [ ] `api.elvasupport.in` (if Option B)

### TLS
- [ ] Wildcard (or SAN) certificate installed at proxy

### Environment
- [ ] Production secrets set (not committed)
- [ ] `TRUST_PROXY=1` behind proxy
- [ ] CORS + `TENANT_BASE_DOMAIN`
- [ ] `ENSURE_ADMIN_ON_STARTUP` false (recommended)

### MongoDB / Migrations
- [ ] Backup
- [ ] `migrate:up` intentionally
- [ ] No Phase 13 schema migration expected

### Frontend
- [ ] Build with `API_URL=…`
- [ ] Deploy single artifact to all portal hosts

### Verification
- [ ] `https://admin.elvasupport.in` → platform
- [ ] `https://elva.elvasupport.in` → tenant
- [ ] `https://unknown.elvasupport.in` → unavailable (not ELVA)
- [ ] `GET /health` and `/health/ready`
- [ ] `npm run verify:production-config`

### Rollback
- [ ] Redeploy previous app version
- [ ] Do not reverse unrelated migrations unless required

## 18. Rollback Strategy

Roll back application artifacts and environment to the previous known-good release. Phase 13 introduces no tenant data migration; rollback is deploy-time only.

## 19. Test Results

See Phase 13 implementation report (automated unit/integration + portal verify + production build).

## 20. Known Limitations

- DNS/TLS not provisioned by the repository
- Favicon / custom domains still out of scope
- Option B depends on browser `Origin` for tenant APIs
- CSP intentionally not enforced strictly for SPA compatibility
