# Launch Readiness Checklist

Final production cutover checklist (Phase 15). Complete every box before declaring launch.

## PRE-DEPLOYMENT

- [ ] Phase 1–15 code reviewed for this release
- [ ] Staging environment smoke-tested (platform + 2 tenants)
- [ ] Staging backup/restore drill completed once
- [ ] Release artifact tagged (`APP_VERSION` / `GIT_SHA`)
- [ ] Rollback owner assigned ([deployment/rollback.md](./deployment/rollback.md))

## DATABASE

- [ ] Production `MONGODB_URI` verified (correct DB name)
- [ ] Backup taken and restore location recorded
- [ ] `npm run migrate:status` reviewed
- [ ] Pending migrations inspected ([migration-verification.md](./migration-verification.md))
- [ ] `npm run migrate:up` executed intentionally
- [ ] `npm run migrate:status` shows all applied (incl. Phase 15 OTP indexes)
- [ ] Critical tenant indexes present

## ENVIRONMENT

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` strong non-default
- [ ] `INTERNAL_API_KEY` strong non-default
- [ ] `TENANT_BASE_DOMAIN=elvasupport.in` (or final domain)
- [ ] `CORS_ALLOWED_ORIGINS` exact list (no `*`)
- [ ] `CORS_ALLOW_TENANT_SUBDOMAINS=true`
- [ ] `TRUST_PROXY` set for reverse-proxy hop count
- [ ] `TENANT_HEADER_OVERRIDE_ENABLED` unset/false
- [ ] `TENANT_REJECT_HEADER_IN_PRODUCTION` not false
- [ ] `TENANT_DEV_DEFAULT_SLUG` unset
- [ ] `ENSURE_ADMIN_ON_STARTUP` unset/false
- [ ] `LOG_OTP_TO_CONSOLE=false`
- [ ] `EXPOSE_OTP_IN_RESPONSE` unset/false
- [ ] `NOTIFICATION_FALLBACK_ENABLED=false`
- [ ] `LOG_FORMAT=json`, `LOG_LEVEL=info`, `LOG_HEALTH_REQUESTS=false`
- [ ] `RATE_LIMIT_ENABLED=true`
- [ ] `GRACEFUL_SHUTDOWN_TIMEOUT_MS` set
- [ ] `METRICS_ENDPOINT_ENABLED` false OR protected by proxy + key
- [ ] Email provider configured (Resend recommended on Render)

## DNS

- [ ] `admin.<domain>` → load balancer
- [ ] `*.<domain>` → load balancer
- [ ] `api.<domain>` → load balancer **only if Option B**
- [ ] No accidental apex→ELVA fallback assumptions

## TLS

- [ ] Wildcard (or SAN) certificate covers admin + tenants (+ api if used)
- [ ] HTTP → HTTPS redirect
- [ ] HSTS as appropriate at edge

## BACKEND

- [ ] API process starts cleanly
- [ ] Startup logs show version metadata
- [ ] `GET /health` → `ok` (liveness)
- [ ] `GET /health/ready` → `ready`
- [ ] Workers start (notification / inbound as configured)
- [ ] Graceful shutdown tested once in staging (`SIGTERM`)

## FRONTEND

- [ ] Production build with correct `API_URL` / portal config
- [ ] `npm run verify:portal` passed in CI/release
- [ ] `ng build --configuration production` (or `npm run build`) succeeded
- [ ] Platform / tenant / merchant portals resolve correctly

## PLATFORM

- [ ] `npm run ensure:platform-admin` completed (once)
- [ ] Platform login works
- [ ] Provisioning + audit + integrity UI accessible to SUPER_ADMIN

## TENANT

- [ ] ELVA workspace login works
- [ ] Second tenant provisioned and isolated
- [ ] Public branding loads on tenant host
- [ ] Unknown tenant host shows unavailable (not ELVA)

## SECURITY

- [ ] Tenant JWT → platform API denied
- [ ] Platform JWT → tenant API denied
- [ ] Cross-tenant ObjectId access denied
- [ ] Production `X-Tenant-Slug` rejected
- [ ] Rate limits active on auth/OTP/onboarding
- [ ] Internal sync callers send `tenantSlug` (or use service context)

## MONITORING

- [ ] Log aggregation captures stdout JSON
- [ ] Alert on `/health` failure
- [ ] Alert on `/health/ready` failure
- [ ] Operators know `requestId` / security_event fields
- [ ] Incident runbook bookmarked ([operations/incident-response.md](./operations/incident-response.md))

## BACKUP

- [ ] Backup schedule enabled (Atlas or mongodump)
- [ ] Retention policy set
- [ ] Restore procedure owners named
- [ ] Post-restore verification steps understood

## POST-DEPLOYMENT

- [ ] Platform smoke (Scenario A)
- [ ] Tenant A smoke (Scenario B)
- [ ] Tenant B smoke (Scenario C)
- [ ] Isolation probes (Scenario D)
- [ ] Ops smoke: email/notification/attachment (Scenario E)
- [ ] Integrity scan run once
- [ ] No unexpected `INTERNAL_ERROR` / security event surge
- [ ] Rollback window held until sign-off
