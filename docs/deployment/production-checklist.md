# Production Deployment Checklist (Phase 13)

Copy this checklist for each production cutover.

## DNS
- [ ] `admin.elvasupport.in` → load balancer
- [ ] `*.elvasupport.in` → load balancer
- [ ] `api.elvasupport.in` → load balancer (Option B only)

## TLS
- [ ] Wildcard `*.elvasupport.in` (and apex/admin as needed)
- [ ] HTTP → HTTPS redirect

## Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI`, `JWT_SECRET`, `INTERNAL_API_KEY` (non-dev defaults)
- [ ] `TENANT_BASE_DOMAIN=elvasupport.in`
- [ ] `CORS_ALLOWED_ORIGINS=https://admin.elvasupport.in`
- [ ] `CORS_ALLOW_TENANT_SUBDOMAINS=true`
- [ ] `TRUST_PROXY=1` (behind reverse proxy)
- [ ] `ENSURE_ADMIN_ON_STARTUP` unset/false
- [ ] No `TENANT_HEADER_OVERRIDE_ENABLED=true`
- [ ] No `TENANT_DEV_DEFAULT_SLUG`
- [ ] Email provider configured (Resend/SMTP)

## MongoDB
- [ ] Backup taken
- [ ] `npm run migrate:status`
- [ ] `npm run migrate:up` (intentional — not automatic)
- [ ] Confirm Phase 13 needs **no** new migration

## Platform Admin Bootstrap
- [ ] `npm run ensure:platform-admin` only when creating/rotating platform admin
- [ ] Never auto-run on API start

## Frontend Build
- [ ] `API_URL=https://api.elvasupport.in/api` (or same-origin `/api` base)
- [ ] `TENANT_BASE_DOMAIN` / `PLATFORM_ADMIN_HOST`
- [ ] `npm run build`
- [ ] `npm run verify:portal`

## Backend Deployment
- [ ] Deploy API
- [ ] `TRUST_PROXY` matches proxy hop count
- [ ] Proxy preserves `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`

## CORS / Trusted Proxy
- [ ] Browser calls from admin + tenant hosts succeed
- [ ] Evil lookalike origins rejected
- [ ] `npm run verify:production-config`

## Health Checks
- [ ] `GET /health` → `{ "status": "ok" }`
- [ ] `GET /health/ready` → `{ "status": "ready" }`

## Host Verification
- [ ] `https://admin.elvasupport.in` → Platform
- [ ] `https://elva.elvasupport.in` → ELVA workspace
- [ ] `https://unknown.elvasupport.in` → unavailable (not ELVA)
- [ ] `https://api.elvasupport.in` not treated as a tenant portal

## Rollback
- [ ] Previous app artifact identified
- [ ] Env snapshot saved
- [ ] Rollback procedure understood (no Phase 13 DB undo required)
