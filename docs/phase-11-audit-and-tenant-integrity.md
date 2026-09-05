# Phase 11 — Audit Console & Tenant Data Integrity

## 1. Architecture Overview

Phase 11 adds:

1. **Tenant Audit Console** — ADMIN-only UI over the Phase 10 `GET /api/audit` API
2. **Enhanced Platform Audit Console** — filters and clearer metadata display
3. **Tenant Integrity Diagnostics** — on-demand platform scans for missing/invalid/mismatched `tenantId`
4. **Safe repair tools** — SUPER_ADMIN only, allowlisted collections, confirmation required, platform-audited

No automatic destructive repairs. Ambiguous ownership is never auto-assigned.

## 2. Existing Audit Infrastructure Reused

| System | Model | Scope |
| ------ | ----- | ----- |
| Tenant | `AuditLog` | Workspace activity |
| Platform | `PlatformAuditLog` | Platform admin / provisioning / integrity |

`logAudit` and `logPlatformAudit` remain the write paths. Systems are never merged.

## 3. Tenant Audit Console

- Route: `/audit` (tenant workspace)
- Nav: Audit Log (ADMIN only)
- Expandable row details with redacted metadata

## 4. Tenant Audit API and Filters

`GET /api/audit` (extended):

- Always scopes to `req.tenant._id`
- Filters: `action`, `entityType`, `actorId`, `entityId`, `from`, `to`, `search`, `page`, `limit`
- `GET /api/audit/:id` for detail
- Response: `{ data, pagination }` using project pagination util
- Metadata redacted on read (`password`, `token`, `secret`, etc. → `[REDACTED]`)

## 5. Platform Audit Console

- Existing `/audit` UI enhanced with search, action, target type, date range
- API filters extended; SUPPORT still denied (least privilege)

## 6. Tenant Data Integrity Architecture

Module: `backend/src/modules/tenant-integrity/`

- On-demand scanner (cursors, per-collection caps)
- Repair service with allowlist + relationship checks
- Mounted at `/api/platform/integrity`

## 7. Integrity Checks Implemented

Collections: users, applications, teams, merchantprofiles, merchantsessions, tickets, ticketsequences, emailthreads, inboundmailqueues, classificationqueues, notificationevents, notificationdeliveries, auditlogs

Checks:

1. Missing `tenantId`
2. Invalid tenant reference
3. Relationship mismatches (ticket↔application/merchant, email thread↔ticket, delivery↔event)

## 8. Finding Types and Severity

| Type | Severity guidance |
| ---- | ----------------- |
| MISSING_TENANT + deterministic parent | WARNING, `repairable: true` |
| MISSING_TENANT without safe derivation | HIGH, not repairable |
| INVALID_TENANT_REF | CRITICAL |
| TENANT_MISMATCH | CRITICAL, not auto-repairable |

## 9. Safe Auto-Repair Architecture

Deterministic only, e.g.:

- EmailThread ← Ticket.tenantId
- NotificationDelivery ← NotificationEvent.tenantId
- MerchantSession ← MerchantProfile.tenantId
- Team ← Application.tenantId
- Queue item with ticketId ← Ticket.tenantId

`POST /api/platform/integrity/repair-auto` supports `dryRun` and requires `confirmation: true` when applying.

## 10. Manual Repair Controls

`POST /api/platform/integrity/repair`

- Allowlisted collection
- Valid record + tenant
- Relationship consistency validated
- Explicit `confirmation: true`

## 11. Platform Permissions

| Role | Diagnostics | Repair |
| ---- | ----------- | ------ |
| PLATFORM_SUPER_ADMIN | Yes | Yes |
| PLATFORM_ADMIN | Yes (read) | No |
| PLATFORM_SUPPORT | No | No |

## 12. Repair Audit Logging

Platform actions:

- `TENANT_INTEGRITY_SCAN_STARTED` / `COMPLETED` (explicit scan)
- `TENANT_DATA_REPAIRED`
- `TENANT_DATA_REPAIR_REJECTED`
- `TENANT_DATA_AUTO_REPAIR_COMPLETED`

## 13–16. Audit Event Quality

Added tenant audit actions for workspace, staff lifecycle, applications, teams, modules. Fixed missing `tenantId` on some ticket assign / merchant login audits.

## 17. Database Migrations

`20260905195000-phase11-audit-integrity-indexes.js`

- `{ tenantId, createdAt }` (+ action/entityType compounds) on `auditlogs`
- Platform audit action/target indexes

## 18. Security Validation

Tenant audit always from `req.tenant`; cross-tenant impossible; TEAM_LEAD denied; platform JWT ≠ tenant audit; repairs SUPER_ADMIN only; allowlist; null-tenant tenant APIs remain fail-closed; metadata redacted.

## 19. Performance

Bounded findings per collection (100); cursor-based scans; on-demand only; no continuous worker.

## 20. Known Limitations

- Full scans can be expensive on very large DBs — filter by collection
- Ambiguous null-tenant rows stay unrepaired until manual SUPER_ADMIN action
- Client CRUD audit not fully instrumented if separate from merchant-admin paths
- Integrity findings are not persisted between requests

## 21. Recommendations for Phase 12

- Optional finding snapshot store for historical trends
- Per-tenant inbound mailbox isolation (from Phase 10)
- Soft-delete retention for DEACTIVATED users
- Tenant audit export
