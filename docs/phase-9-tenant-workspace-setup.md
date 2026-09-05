# Phase 9 — Tenant Workspace Setup

## 1. Phase 9 Objective

After platform provisioning creates a tenant and the tenant admin activates their account, the admin must be able to configure their own support workspace without ELVA developer intervention:

Organization → Branding → Teams → Applications → Users → Clients → Ready

## 2. Existing Capability Audit

| Feature | Current Status | Already Exists? | Tenant Scoped? | Needs Changes? | Needs UI? |
| ------- | -------------- | --------------- | -------------- | -------------- | --------- |
| Applications CRUD | Working | Yes | Yes | No | Existing ADMIN screens |
| Modules CRUD | Working | Yes | **Fixed in Phase 9** (was unguarded) | Isolation guards | Existing |
| Teams CRUD | Working | Yes | Yes | No | Existing |
| Users CRUD | Working | Yes | Yes | No (staff invite deferred) | Existing password onboarding |
| Merchants / Clients | Working | Yes | Yes | UI label → Clients | Existing |
| Tenant settings Mixed | Opaque bags | Yes | N/A | Typed write APIs | New Settings + Setup |
| BrandingService | Stub defaults | Frontend stub | N/A | Wire to API | Header/login |
| Email branding | Slug heuristic | Phase 8 | Yes | Read `settings.branding` | N/A |
| Workspace setup status | Missing | No | — | New `tenant.setup` | Setup wizard + checklist |
| Logo upload | Missing | No | — | New storage path | Settings / Setup |
| Platform setup visibility | Missing | No | — | `setup` on tenant DTO | Businesses table |

## 3. Platform vs Tenant Responsibilities

**Platform (`admin.elvasupport.in`)**

- Provision tenants, lifecycle, platform admins, provisioning status
- Sees setup status summary only (NOT_STARTED / IN_PROGRESS / COMPLETED + progress)
- Cannot call `/api/workspace/*` with platform JWT

**Tenant (`{slug}.elvasupport.in`)**

- ADMIN configures organization, branding, teams, apps, modules, users, clients
- TEAM_LEAD / AGENT: operational features only (no workspace settings)

## 4. Workspace Setup Architecture

```
TenantProvisioned (READY)
    → Tenant Admin activates account (/setup-account)
    → Login
    → If setup.status !== COMPLETED → /setup (resumable)
    → Configure org/branding; create team/app/users/clients via existing screens
    → setup recomputed from real data
```

Module: `backend/src/modules/workspace/`

Routes mounted at `/api/workspace`.

## 5. Setup Status Model

On `Tenant`:

```js
setup: {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
  steps: { organization, branding, team, application, users, client },
  skipped: { branding, users, client },
  completedAt: Date | null
}
```

Distinct from `TenantProvisioning.status` (technical creation).

**Required for COMPLETED:** organization + team + application  
**Recommended / skippable:** branding, users, client

## 6. First Login Experience

After staff login, ADMIN users with incomplete setup are redirected to `/setup`.  
TEAM_LEAD / AGENT go to `/dashboard`.  
Setup never permanently blocks the workspace (dashboard still reachable; checklist shown until complete).

## 7. Organization Settings

`PATCH /api/workspace/organization` (ADMIN)

Fields: displayName, legalName, supportDisplayName, primaryContact*, supportEmail, phone, website, timezone, country, address.

Slug remains immutable (platform-only).

## 8. Branding Architecture

`PATCH /api/workspace/branding`  
`POST/DELETE /api/workspace/branding/logo`  
`GET /api/workspace/branding/public` (tenant context, no staff JWT)  
`GET /api/workspace/branding/logo` (streams file for current tenant)

Stored under `tenant.settings.branding`.

## 9. Logo Storage and Security

- ADMIN only for upload/delete
- MIME: PNG / JPEG / WebP; max 2MB; extension allowlist
- Path: `{tenantSlug}/branding/` via existing Drive/mock upload abstraction
- Cross-tenant overwrite impossible (membership + folder slug from `req.tenant`)
- SVG not allowed

## 10. Workspace Settings APIs

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/workspace/settings` | Staff + membership |
| GET | `/api/workspace/setup-status` | Staff + membership |
| PATCH | `/api/workspace/organization` | ADMIN |
| PATCH | `/api/workspace/branding` | ADMIN |
| POST | `/api/workspace/branding/logo` | ADMIN |
| DELETE | `/api/workspace/branding/logo` | ADMIN |
| POST | `/api/workspace/setup/skip/:step` | ADMIN |
| GET | `/api/workspace/branding/public` | Tenant context |
| GET | `/api/workspace/branding/logo` | Tenant context |

Client-supplied `tenantId` is ignored.

## 11. Setup Wizard / Checklist

Frontend:

- `/setup` — guided, resumable wizard (ADMIN)
- `/settings` — organization + branding editor + shortcuts
- Dashboard checklist when setup incomplete

## 12. Team Configuration

Reuses existing `/teams` ADMIN CRUD. Setup step completes when ≥1 active team exists.

## 13. Employee / User Management

Reuses existing `/users` ADMIN CRUD (password + welcome email).

**Staff invitation system:** not duplicated in Phase 9. Existing create-user + email credentials remain. Recommended for Phase 10: generalize Phase 6 invitation tokens for staff.

## 14. Staff Invitation Flow

Not implemented in Phase 9 (avoid identity rewrite). Documented as Phase 10.

## 15. Applications and Modules

Applications: existing tenant-scoped CRUD.  
Modules: Phase 9 added `requireTenantContext` + membership and filters via parent Application tenant.

## 16. Client / Merchant Management

Backend model remains `MerchantProfile`.  
Frontend nav/label uses **Clients** (ELVA can still think “merchants”).  
`customerLabel` setting deferred.

## 17. Frontend Navigation and Roles

ADMIN: Dashboard, tickets, Applications, Modules, Teams, Clients, Inbound Mail, Users, Settings  
TEAM_LEAD: operational + Workload  
AGENT: operational only  

Backend remains the security boundary.

## 18. Platform Visibility into Setup Status

`toPublicTenant` includes:

```json
"setup": { "status": "IN_PROGRESS", "progress": { "completed": 4, "total": 6 }, "completedAt": null }
```

Businesses table shows setup status. No ticket/message visibility.

## 19. ELVA Backward Compatibility

Migration `20260905180000-phase9-workspace-setup-backfill.js`:

- Adds `setup` to all tenants
- Marks `elva` COMPLETED when teams + applications exist
- Seeds ELVA organization/branding defaults (`ELVA Support`)

Dynamic recompute also treats operational ELVA as complete after migration.

## 20. Email Branding Integration

`buildEmailBranding(tenant)` prefers `settings.branding.supportDisplayName`, else `{name} Support`, else `ELVA Support` for slug `elva`.

## 21. Frontend Branding Integration

`BrandingService.loadTenantBranding()` loads public branding + logo blob (headers apply). Used by shell and login.

## 22. Database Migrations

`backend/migrations/20260905180000-phase9-workspace-setup-backfill.js`

## 23. Security Decisions

- Platform JWT rejected by staff authenticate
- Tenant JWT rejected by platform authenticate
- Workspace mutations ADMIN-only
- Logo isolation by tenant slug folder + membership
- No platform bypass into tenant operational data

## 24. Testing

`backend/tests/integration/phase-9-workspace-setup.test.js` plus regression suites.

## 25. Known Limitations

- Staff onboarding still emails plaintext passwords (pre-existing)
- No SVG logos
- Primary color stored; full runtime theme engine not applied
- Production tenant resolution still depends on host/proxy architecture (pre-existing)
- Dashboard / classification / inbound-mail tenant gaps outside Phase 9 scope (modules fixed)
