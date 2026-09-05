# Operational Troubleshooting Guide

Use `requestId` (response header `X-Request-ID` / body `requestId`), `tenantSlug`, and `tenantId` when asking for help.

## Tenant cannot log in

1. Confirm hostname is `{slug}.{TENANT_BASE_DOMAIN}` (not platform admin host).
2. Confirm tenant status is ACTIVE.
3. Confirm user belongs to that tenant and lifecycle allows login.
4. Check `AUTH_LOGIN_FAILED` / 401 generic message (do not reveal account existence).
5. Check rate limit 429 → wait or reset limiter for IP after verifying legitimacy.
6. Capture `requestId` from login response.

## Platform admin cannot log in

1. Use `admin.{TENANT_BASE_DOMAIN}` portal and `/api/platform/auth/login`.
2. Confirm platform admin status authenticatable.
3. Confirm JWT_SECRET unchanged across instances.
4. Search `PLATFORM_LOGIN_FAILED` / `AUTH_RATE_LIMITED`.

## Workspace hostname invalid

1. Multi-level or reserved hosts are rejected (`INVALID_TENANT_HOST`).
2. Unknown slug → `TENANT_NOT_FOUND` (no ELVA fallback).
3. Verify DNS and `TENANT_BASE_DOMAIN`.

## CORS blocked

1. Exact origin must be allowlisted or match tenant subdomain rules.
2. Do not use `*` for credentialed APIs.
3. Verify `CORS_ALLOW_TENANT_SUBDOMAINS` and HTTPS requirements in production.

## Tenant context missing

1. API host without tenant Origin/Host cannot resolve tenant.
2. Production rejects `X-Tenant-Slug` override.
3. Ensure `TRUST_PROXY` matches reverse-proxy hops for Host / client IP.

## Invitation setup fails

1. Tokens are single-use / expiried → generic invalid responses.
2. Search `INVITATION_TOKEN_INVALID` / `INVITATION_TOKEN_EXPIRED` (no raw token in logs).
3. Confirm invitation not revoked; user still inactive pending setup.

## Email queue stuck

1. Check notification worker enabled and provider credentials.
2. Logs: `notification_job_start` / `_success` / `_failure`, delivery retry/exhaustion.
3. Do not dump email bodies from logs.

## Classification queue stuck

1. Confirm classification jobs/errors in application logs.
2. Verify tenant-scoped data still isolatable after retries.

## Notification failures

1. Distinguish primary provider fail vs fallback exhaustion.
2. Check Resend/SMTP outbound blocks (Render free tier SMTP).

## Health readiness failing

1. `/health` ok + `/health/ready` not_ready ⇒ MongoDB.
2. Check URI, network, Atlas pause, IP allowlist.

## Migration failed

1. Stop further migrate attempts until backup verified.
2. Prefer forward-fix; see [rollback.md](../deployment/rollback.md).

## Cross-tenant access blocked unexpectedly

1. User JWT tenantId must match resolved host tenant.
2. Switching workspace host while keeping old token fails closed — re-login on that host.
3. Security event `CROSS_TENANT_ACCESS_BLOCKED` is expected for mismatch (not a 404).

## Reference fields for support

| Field | Source |
|-------|--------|
| requestId | `X-Request-ID` header / error JSON |
| tenantSlug | hostname / workspace URL |
| tenantId | internal (ops tools / DB) — avoid exposing unnecessarily |
| APP_VERSION / GIT_SHA | startup logs, `/health/detail` |
