# Master Feature: Domain Provisioning + Tenant SLA Engine + Ticket Lifecycle

## 1. Executive Summary

This release adds three connected production capabilities without redesigning the multi-tenant platform:

1. **Environment-driven tenant workspace domains** with wildcard DNS readiness (no per-tenant Cloudflare records)
2. **Tenant-scoped Priority + SLA + percentage-based Escalation** configuration and monitoring
3. **Ticket Resolve → Client Close → Client Reopen** lifecycle with previous-agent-first reassignment and new SLA cycles

Phases 1–15 security and production guarantees are preserved. No git commits, DNS, or Cloudflare changes are performed by this application work.

---

## 2. Architecture Decisions

| Decision | Choice |
|----------|--------|
| Tenant hostname | `{slug}.{TENANT_BASE_DOMAIN}` from env |
| DNS model | Wildcard (`*.{TENANT_BASE_DOMAIN}`) — app validates tenant existence |
| Per-tenant DNS API | **Not used** |
| SLA config storage | `Tenant.settings.serviceManagement` |
| SLA cycles | Embedded on Ticket (`sla.currentCycle` + `sla.history`) |
| Escalation | Percentage thresholds, idempotent via `triggeredThresholds` |
| WAITING_FOR_CUSTOMER pause | **Not paused** in this release (documented limitation) |
| Agent close | Agents **resolve**; clients **close** |
| Reopen assignment | Previous agent if eligible + under capacity; else existing auto-assign |

---

## 3. Environment-Driven Domain Model

Required / preferred variables (already present; reused):

```env
TENANT_BASE_DOMAIN=support.elvatech.in
PLATFORM_ADMIN_HOST=admin.support.elvatech.in
TENANT_WORKSPACE_PROTOCOL=https
```

Helpers live in `backend/src/modules/tenants/workspace-domain.service.js`:

- `buildWorkspaceHost` / `buildWorkspaceUrl` / `buildInvitationUrl`
- `checkWorkspaceAvailability`

Invitation emails continue to use these helpers (via `invitation-token.util.js` re-exports). Business logic must not hardcode production domains.

---

## 4. Wildcard DNS Architecture

Production configures **once**:

```text
*.support.elvatech.in  →  frontend / reverse-proxy / load balancer
```

Every tenant hostname resolves through DNS automatically. The application decides validity by looking up the tenant slug in MongoDB.

Changing `TENANT_BASE_DOMAIN` later (e.g. to `elvasupport.in`) requires DNS/TLS/proxy readiness for the new wildcard — **not** application code changes.

---

## 5. Why Individual Cloudflare Records Are Not Required

Wildcard DNS already routes all `{slug}.{base}` hosts. Creating a DNS record per tenant would add operational cost and couple provisioning to Cloudflare APIs. Provisioning language intentionally says **workspace prepared / hostname available**, never “DNS record created.”

---

## 6. Provisioning Availability Flow

Platform UI: **Provision Business**

1. Enter slug → preview `https://{slug}.{tenantBaseDomain}` from frontend env
2. **Check Availability & Prepare Workspace** → `GET /api/platform/tenants/slug-availability?slug=`
3. Checks: format, reserved, unique, hostname structure, wildcard readiness metadata
4. Provision button disabled until current slug validation succeeds
5. Slug change invalidates prior result
6. After provision: invitation email uses generated workspace URL

Localhost / Phase 7–13 portal modes remain unchanged.

---

## 7. Tenant Priority Configuration

Defaults: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`

Configurable per tenant:

- enabled / customer selectable / display order / label
- CRITICAL default: **not** customer-selectable

Staff may change ticket priority (audited). Customers may only select allowed priorities on create.

---

## 8. SLA Engine Architecture

On ticket create:

Priority → matching tenant SLA policy → cycle 1 starts

Tracked fields include cycle number, startedAt, response/resolution due, first response, resolved, states, breached timestamps, triggered thresholds.

States: `ON_TRACK`, `WARNING`, `AT_RISK`, `BREACHED`, `COMPLETED`

Historical tickets without SLA: **no retroactive cycle** (`hasSla: false`) — safest for existing data.

---

## 9. Business-Hours Calculation

`business-hours.util.js` supports:

- timezone, working days, start/end time
- calendar minutes when `useBusinessHours: false`
- business-minute accumulation when enabled (LOW default uses business hours for “5 business days”)

Holiday calendars are out of scope.

---

## 10. Percentage-Based Escalation Lifecycle

Default resolution thresholds: 50% → assignee, 75% → team lead, 90% → assignee urgent, 100% → mark breached + notify.

Worker: `sla-escalation-worker.service.js` (same interval pattern as notification/email workers).

Idempotency key: `{metric}:{thresholdPercent}` on the active cycle.

---

## 11. Worker Architecture

Started from `server.js` with graceful shutdown registration.

Uses ticket/job tenant ownership only. Skips non-operable tenants. Failures are logged and do not crash the process.

---

## 12–14. Ticket Resolution / Closure / Reopening

| Actor | Action | Result |
|-------|--------|--------|
| Agent | Resolve | `RESOLVED`, complete SLA cycle, notify client |
| Client | Close | `CLOSED` (own ticket only, must be RESOLVED) |
| Client | Reopen | New SLA cycle; previous agent first; else auto-assign |
| Agent | Close | Rejected on staff status API |

Agent cannot reopen CLOSED tickets via client APIs (merchant auth required).

---

## 15. Previous-Agent Reassignment Algorithm

1. Prefer `previousAssignedTo` / assigned / resolvedBy  
2. Active, login-allowed, same tenant, team-compatible  
3. Capacity: active tickets &lt; `agentMaxActiveTickets` (default 10)  
4. Else existing `autoAssignOnCreate`

---

## 16. SLA Cycle History

Completed/superseded cycles append to `ticket.sla.history`. Reopen starts cycle N+1 with new deadlines from **current** tenant policy.

---

## 17. Security and Tenant Isolation

Verified by design:

1. Service management ADMIN + tenant membership scoped  
2. Ticket SLA reads tenant-scoped  
3. Client close/reopen ownership checks  
4. Agent cannot use merchant close/reopen routes  
5. Platform slug-availability requires platform JWT  
6. Tenant JWT cannot call platform routes  
7. Client-provided tenantId ignored (middleware context)  
8. Escalation worker uses ticket.tenantId  
9. Duplicate thresholds prevented  
10. Reopen assignment uses tenant-scoped agent queries  

---

## 18. Database Migrations

`backend/migrations/20260905220000-master-service-management-defaults.js`

- Additive backfill of `settings.serviceManagement` when missing  
- Optional SLA index  
- Non-destructive down  

Run intentionally:

```bash
cd backend && npm run migrate:up
```

---

## 19. API Changes

**Platform**

- `GET /api/platform/tenants/slug-availability?slug=`

**Workspace (ADMIN)**

- `GET/PATCH /api/workspace/service-management`

**Staff tickets**

- `POST /api/tickets/:id/resolve`
- `PATCH /api/tickets/:id/priority`
- `GET /api/tickets/:id/sla`
- Status `CLOSED` rejected for agents; `RESOLVED` uses lifecycle

**Merchant**

- `GET /api/merchant/tickets/priorities`
- `POST /api/merchant/tickets/:id/close`
- `POST /api/merchant/tickets/:id/reopen`
- `GET /api/merchant/tickets/:id/sla`

---

## 20. Frontend Changes

- Platform provision: env-based URL preview, availability check, gated provision  
- Workspace settings: Service management section  
- Agent ticket detail: priority, SLA panel, resolve (no agent close)  
- Merchant ticket detail: close / reopen actions  

---

## 21. Test Results

See final implementation report after test run.

Unit suites added:

- `tests/unit/master-workspace-domain.test.js`
- `tests/unit/master-sla-engine.test.js`
- `tests/unit/master-ticket-lifecycle-contracts.test.js`

Integration (Mongo optional):

- `tests/integration/master-domain-sla-lifecycle.test.js`

---

## 22. Backward Compatibility

- Existing tickets without SLA continue to load  
- Existing statuses unchanged  
- Auto-assign free=0 semantics unchanged for new tickets  
- Localhost portal modes unchanged  
- Provisioning READY vs email-failure behavior unchanged  

---

## 23. Known Limitations

- No holiday calendar  
- SLA does **not** pause on `WAITING_FOR_CUSTOMER` (accuracy over silent wrong pause)  
- Escalation emails are simple HTML via existing notification manager  
- Reopen capacity uses max-active threshold; create-time auto-assign still prefers agents with zero active tickets  

---

## 24. Required Production Infrastructure Setup

1. Configure wildcard DNS for `*.{TENANT_BASE_DOMAIN}`  
2. Ensure TLS covers wildcard (or SAN equivalent)  
3. Reverse proxy routes Host header to frontend SPA  
4. Set `TENANT_BASE_DOMAIN` / `PLATFORM_ADMIN_HOST` in API + frontend build envs  
5. Run migration for service-management defaults  
6. Do **not** create per-tenant Cloudflare DNS records for normal provisioning  

Changing base domain later = infra change only for DNS/TLS/proxy; application code already env-driven.
