# Incident Response Runbook

Practical procedures for production incidents (Phase 14). Capture `requestId`, `tenantSlug`, and `APP_VERSION` / `GIT_SHA` in every ticket.

## Shared first steps

1. Check `GET /health` (liveness) and `GET /health/ready` (MongoDB).
2. Confirm which deployment is live (version / git SHA in startup logs or `/health/detail`).
3. Search logs for `requestId` and `security_event`.

---

### A. API unavailable

| Step | Action |
|------|--------|
| Detection | LB 5xx / timeouts; liveness fails |
| Immediate | Check process/container; restart one instance if healthy ready elsewhere |
| Investigation | Startup logs, OOM, port bind, crash (`uncaught_exception`) |
| Recovery | Redeploy last known good artifact; verify `/health` + `/health/ready` |
| Escalation | Infra if host/network; app onsite if crash loop |
| Follow-up | Root cause; add alert on liveness |

### B. MongoDB unavailable

| Step | Action |
|------|--------|
| Detection | `/health/ready` → `not_ready` / `database_unavailable` |
| Immediate | Do not run migrations; pause deploys |
| Investigation | Atlas/status, connection string, IP allowlist, disk |
| Recovery | Restore connectivity; if data loss → [backup-and-restore.md](./backup-and-restore.md) |
| Escalation | DBA / cloud support |
| Follow-up | Connection pool / timeout review |

### C. Tenant workspace unavailable

| Step | Action |
|------|--------|
| Detection | Users report workspace error; `TENANT_NOT_FOUND` / inactive |
| Immediate | Confirm hostname `{slug}.elvasupport.in`; check tenant status |
| Investigation | Tenant document, DNS/host routing, CORS origin |
| Recovery | Reactivate tenant if intentional suspend; fix DNS only via change control |
| Escalation | Platform admin for tenant status |
| Follow-up | Comms to affected tenant |

### D. Unknown tenant hostname

| Step | Action |
|------|--------|
| Detection | `TENANT_NOT_FOUND` / invalid host; frontend unavailable page |
| Immediate | Confirm slug not provisioned vs DNS mis-pointed |
| Investigation | Logs `INVALID_TENANT_HOST`; Host vs Origin resolution |
| Recovery | Correct DNS **only** with approval; or provision tenant |
| Escalation | Platform ops |
| Follow-up | Document hostname |

### E. Authentication failures spike

| Step | Action |
|------|--------|
| Detection | `AUTH_LOGIN_FAILED` / `PLATFORM_LOGIN_FAILED` volume |
| Immediate | Confirm not a deploy breaking JWT_SECRET |
| Investigation | Rate-limit events; credential stuffing vs bad config |
| Recovery | Rotate secrets only with planned cutover; keep limits on |
| Escalation | Security if abuse confirmed |
| Follow-up | Review AUTH_RATE_LIMIT_* |

### F. Rate limiting spike

| Step | Action |
|------|--------|
| Detection | `AUTH_RATE_LIMITED`; many 429 |
| Immediate | Distinguish attack vs misconfigured client |
| Investigation | Client IP (requires `TRUST_PROXY` correct); endpoint |
| Recovery | Block abusive IP at proxy if needed; do not disable limits globally |
| Escalation | Security / network |
| Follow-up | Consider distributed limiter if multi-instance |

### G. Cross-tenant security event

| Step | Action |
|------|--------|
| Detection | `CROSS_TENANT_ACCESS_BLOCKED` / token boundary events |
| Immediate | Fail-closed already — do not weaken guards |
| Investigation | Actor token, `tenantId`/`tenantSlug`, `requestId` |
| Recovery | Revoke sessions if compromise suspected |
| Escalation | Security lead |
| Follow-up | Integrity scan (Phase 11) |

### H. Email processing failure

| Step | Action |
|------|--------|
| Detection | `notification_job_failure` / inbound webhook errors |
| Immediate | Check provider status (Resend/SMTP); webhook secret |
| Investigation | Job ID, tenantId; do not log full email bodies |
| Recovery | Fix credentials; replay queue items if safe |
| Escalation | Email vendor |
| Follow-up | Quarantine poison messages |

### I. Background queue failure

| Step | Action |
|------|--------|
| Detection | Worker stopped; poll errors; stuck unprocessed events |
| Immediate | Restart API/workers; check `NOTIFICATION_WORKER_ENABLED` |
| Investigation | `notification_job_*` logs; classification/inbound queues |
| Recovery | Process backlog; skip poison with processed flag if needed |
| Escalation | Engineering |
| Follow-up | Alert on queue depth if metrics added later |

### J. Failed deployment

| Step | Action |
|------|--------|
| Detection | Bad health after deploy; error spike |
| Immediate | [Rollback](../deployment/rollback.md) application artifact |
| Investigation | Diff env vars; migration status |
| Recovery | Restore previous build; DB forward-fix if migration already applied |
| Escalation | Release owner |
| Follow-up | Improve checklist; add version to logs |
