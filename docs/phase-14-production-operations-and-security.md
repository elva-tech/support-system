# Phase 14 — Production Operations, Observability, and Security Hardening

## 1. Executive Summary

Phase 13 made ELVA Support deployment-ready. Phase 14 makes the **running** system operationally safe: structured logging, request correlation, tenant-aware observability, safer errors, focused rate limiting, security event logs, metrics foundations, graceful shutdown, and operator runbooks.

**No database migration required for Phase 14.**  
**No DNS changes. No cloud deployment performed. No paid monitoring required.**

## 2. Observability Architecture

```
Request → Correlation ID → Access / Structured Logs (+ tenant context)
        → Handlers → Error Handler / Metrics → Operator investigation
```

Central pieces live under `backend/src/shared/utils/logger.js`, `middleware/request-id`, `middleware/access-log`, `observability/*`.

## 3. Structured Logging

- Levels via `LOG_LEVEL` (`error|warn|info|debug`)
- `LOG_FORMAT=json` (production default) or `pretty`
- Metadata redacted recursively; passwords/tokens/OTP/Authorization never logged

## 4. Request Correlation IDs

- Middleware validates safe `X-Request-ID` or generates 32-hex ID
- Sets `req.requestId` and response header `X-Request-ID`
- Included on error payloads

## 5. Tenant-Aware Logging

- Uses `req.tenant` when already resolved (`tenantId`, `tenantSlug`)
- Distinguishes `identityType`: `TENANT_USER` | `PLATFORM_ADMIN` | `MERCHANT`
- Workers log `tenantId` from job documents only (no extra DB lookups)

## 6. Access Logging

- Central `http_access` logs: method, path, statusCode, durationMs, request/tenant context
- Health probes suppressed unless `LOG_HEALTH_REQUESTS=true`
- Morgan off by default (`LOG_MORGAN=true` to enable legacy)

## 7. Error Handling

- Operational `ApiError` → existing messages + `requestId`
- Unknown errors → safe generic message + `error.code=INTERNAL_ERROR` (no stack to clients)
- Server logs include structured context

## 8. Sensitive Data Redaction

- `log-redaction.util.js` covers password, token, otp, cookie, authorization, apiKey, secrets, nested objects
- Does not mutate original request objects

## 9. Security Event Logging

Events such as `AUTH_LOGIN_FAILED`, `PLATFORM_LOGIN_SUCCEEDED`, `AUTH_RATE_LIMITED`, `CROSS_TENANT_ACCESS_BLOCKED`, `TENANT_HEADER_OVERRIDE_ATTEMPT`, token boundary violations — ops logs, not AuditLog duplicates.

## 10. Rate Limiting

- Configurable; focused on login, platform login, OTP, onboarding
- Keys: client IP via Express `req.ip` (honors `TRUST_PROXY`)
- In-memory store — document multi-instance limitation; Redis-ready later via store swap

## 11. Authentication Abuse Protection

- Generic auth failures unchanged
- Rate limits on abuse-sensitive routes
- Invitation tokens never logged raw

## 12. Cross-Tenant Security Observability

- Membership mismatch → security event + fail-closed 403
- Production header override → security event + 403
- Platform↔tenant token misuse → security events

## 13. Metrics Foundation

- In-process counters/histograms (low cardinality)
- Optional `GET /metrics` when `METRICS_ENDPOINT_ENABLED=true` + `X-Internal-Api-Key`

## 14. Health Monitoring

| Probe | Path | Use |
|-------|------|-----|
| Liveness | `GET /health` | Load balancer — process up |
| Readiness | `GET /health/ready` | Traffic only when Mongo ready |
| Detail | `GET /health/detail` | Ops — version/storage |

## 15. Application Version Metadata

- `APP_VERSION`, `GIT_SHA`, `BUILD_TIMESTAMP` optional
- Startup logs + `/health/detail`; liveness stays minimal unless `HEALTH_INCLUDE_VERSION=true`

## 16. Graceful Shutdown

- `SIGTERM` / `SIGINT` → stop HTTP, stop workers, close Mongo, exit
- `GRACEFUL_SHUTDOWN_TIMEOUT_MS` (default 15000)
- `uncaughtException` / production `unhandledRejection` → log and exit

## 17. Async Worker Observability

- Notification jobs: start / success / failure
- Delivery: first failure → retry/fallback → exhaustion

## 18. Database Operational Safety

Documented in backup/restore runbook: connection failures surface via readiness; no auto-backup in Node.

## 19. Backup and Restore Strategy

See [operations/backup-and-restore.md](./operations/backup-and-restore.md).

## 20. Incident Response

See [operations/incident-response.md](./operations/incident-response.md).

## 21. Deployment Rollback

See [deployment/rollback.md](./deployment/rollback.md).

## 22. Environment Configuration

See organized sections in `backend/.env.example` (Core, Database, Auth, Tenant, Platform, CORS/Proxy, Rate Limiting, Observability, Email, Shutdown).

## 23. Test Results

Covered by `phase-14-production-operations` integration + unit tests; regression suite for prior phases.

## 24. Database Changes

**No database migration required for Phase 14.**

## 25. Backward Compatibility

API paths, JWT formats, portals, branding, isolation, and Phase 13 hostname behavior preserved. Error responses gain `requestId` without removing `message`.

## 26. Known Limitations

- In-memory rate limits and metrics are per process
- No full Prometheus/Grafana stack shipped
- Logs go to stdout (aggregator-friendly); not a SIEM product
- Frontend shows Reference ID only on HTTP ≥ 500 when `requestId` present
