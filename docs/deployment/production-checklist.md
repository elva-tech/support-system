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
- [ ] Confirm Phase 13/14 need **no** new migration (Phase 14: none)

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
- [ ] `GET /health` → `{ "status": "ok" }` (liveness — LB)
- [ ] `GET /health/ready` → `{ "status": "ready" }` (readiness — MongoDB)
- [ ] Optional: `HEALTH_INCLUDE_VERSION=true` only if version on liveness is desired

## Host Verification
- [ ] `https://admin.elvasupport.in` → Platform
- [ ] `https://elva.elvasupport.in` → ELVA workspace
- [ ] `https://unknown.elvasupport.in` → unavailable (not ELVA)
- [ ] `https://api.elvasupport.in` not treated as a tenant portal

## Observability / Security (Phase 14)
- [ ] `LOG_FORMAT=json`, `LOG_LEVEL=info`, `LOG_HEALTH_REQUESTS=false`
- [ ] `RATE_LIMIT_ENABLED=true` with production AUTH/OTP limits
- [ ] `TRUST_PROXY` correct so rate-limit IP is accurate
- [ ] `GRACEFUL_SHUTDOWN_TIMEOUT_MS` set appropriately
- [ ] Optional `APP_VERSION` / `GIT_SHA` set by CI
- [ ] Operators have runbooks: backup, incident, troubleshooting, rollback

## Rollback
- [ ] Previous app artifact identified
- [ ] Env snapshot saved
- [ ] Rollback procedure understood ([rollback.md](./rollback.md))
- [ ] Phase 14 needs **no** DB undo
