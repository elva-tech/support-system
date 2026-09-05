# Phase 5 — Platform Administration & Tenant Management Backend

## Architecture

```text
TENANT ADMINISTRATION          ≠          PLATFORM ADMINISTRATION
(tenant User, role ADMIN)                 (PlatformAdmin collection)
/api/auth/*                               /api/platform/*
{ sub } JWT                               { sub, identityType: PLATFORM_ADMIN, role }
Requires req.tenant on staff APIs         No tenant context required
```

**Critical rule:** Existing tenant role `ADMIN` means administrator *inside one tenant*. It does **not** grant platform access. Never use `user.role === 'ADMIN'` for platform authorization.

## PlatformAdmin Model

Collection: `platformadmins`

| Field | Notes |
|-------|--------|
| name | Display name |
| email | Unique, lowercase |
| password | bcrypt (cost 12), `select: false`, never returned |
| role | Platform roles only |
| status | ACTIVE / INVITED / SUSPENDED / DISABLED |
| lastLoginAt | Updated on successful login |
| createdBy | Optional ref to another PlatformAdmin |

## Platform Roles

| Role | Capabilities (Phase 5) |
|------|-------------------------|
| `PLATFORM_SUPER_ADMIN` | Manage platform admins; full tenant lifecycle |
| `PLATFORM_ADMIN` | Create/update tenants; create non-super platform admins; cannot create/promote Super Admins |
| `PLATFORM_SUPPORT` | List/get tenant metadata only |

Permissions are **explicit** (listed per route). Hierarchy is not automatic.

## Platform Authentication

| Endpoint | Purpose |
|----------|---------|
| `POST /api/platform/auth/login` | Platform login |
| `GET /api/platform/auth/me` | Current platform admin |

Separate from `POST /api/auth/login` (tenant staff).

Authenticatable status: **ACTIVE** only. INVITED / SUSPENDED / DISABLED → denied.

## JWT and Token Separation

Platform JWT payload:

```json
{
  "sub": "<platformAdminId>",
  "identityType": "PLATFORM_ADMIN",
  "role": "PLATFORM_SUPER_ADMIN"
}
```

Tenant staff JWT remains `{ "sub": "<userId>" }` (no `identityType`).

| Token | Platform APIs | Tenant staff APIs |
|-------|---------------|-------------------|
| Tenant JWT | Denied | Allowed |
| Platform JWT | Allowed | Denied |

Middleware:

- `authenticatePlatformAdmin` — requires `identityType === PLATFORM_ADMIN`
- `authenticate` / `flexibleAuth` — reject `identityType === PLATFORM_ADMIN`

## Tenant Management APIs

| Method | Path | Roles |
|--------|------|-------|
| POST | `/api/platform/tenants` | SUPER, ADMIN |
| GET | `/api/platform/tenants` | SUPER, ADMIN, SUPPORT |
| GET | `/api/platform/tenants/:tenantId` | SUPER, ADMIN, SUPPORT |
| PATCH | `/api/platform/tenants/:tenantId` | SUPER, ADMIN |
| POST | `.../activate` | SUPER, ADMIN |
| POST | `.../suspend` | SUPER, ADMIN |
| POST | `.../cancel` | SUPER, ADMIN |
| POST | `.../archive` | SUPER, ADMIN |

**Slug is immutable** through normal PATCH. Slug rename is intentionally not implemented (hostname impact).

Does not expose tenant users, merchants, tickets, or passwords.

## Tenant Lifecycle

Allowed transitions:

```text
TRIAL → ACTIVE | SUSPENDED | CANCELLED
ACTIVE → SUSPENDED | CANCELLED | TRIAL
SUSPENDED → ACTIVE | CANCELLED
CANCELLED → ARCHIVED
ARCHIVED → (terminal)
```

No physical tenant deletion in Phase 5.

Suspended/cancelled/archived tenants continue to be blocked from tenant workspace traffic by Phase 4 operable-status checks.

## Platform Admin Management

| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/platform/admins` | SUPER, ADMIN |
| POST | `/api/platform/admins` | SUPER, ADMIN |
| PATCH | `/api/platform/admins/:adminId` | SUPER, ADMIN |

`PLATFORM_ADMIN` cannot create or promote `PLATFORM_SUPER_ADMIN`.

## First Super Admin Bootstrap

```bash
cd backend
PLATFORM_ADMIN_EMAIL=you@example.com \
PLATFORM_ADMIN_PASSWORD='...' \
PLATFORM_ADMIN_NAME='Platform Super Admin' \
npm run ensure:platform-admin
```

- Idempotent (email lookup)
- Does **not** run on API startup
- Does **not** convert tenant `ADMIN` users
- Does **not** log passwords

## First Super Admin Protection

Cannot disable or demote the **last** active `PLATFORM_SUPER_ADMIN`.

## Platform Audit

Collection: `platformauditlogs` (not tenant `AuditLog`).

Actions include: login, tenant created/updated/lifecycle, platform admin created/role/status changes.

`GET /api/platform/audit` — SUPER + ADMIN (basic list).

## Security Boundaries

1. Tenant ADMIN cannot access Platform APIs.
2. Platform Admin token cannot authenticate as tenant staff.
3. Platform actions do **not** require `req.tenant`.
4. Platform audit is not faked as ELVA tenant audit.

## CORS (future)

When `admin.elvasupport.in` ships, add `https://admin.elvasupport.in` to `CORS_ORIGIN`. Do not use `*` for authenticated platform APIs. Hostname checks for platform auth are **not** required in Phase 5.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PLATFORM_ADMIN_EMAIL` | Bootstrap only |
| `PLATFORM_ADMIN_PASSWORD` | Bootstrap only |
| `PLATFORM_ADMIN_NAME` | Bootstrap only (optional) |

Unrelated: `ADMIN_EMAIL` / `ADMIN_PASSWORD` continue to seed the ELVA **tenant** admin.

## Migrations

`20260905150000-create-platform-admin-collections.js` — indexes for `platformadmins` and `platformauditlogs`.

```bash
npm run migrate:up
```

## Out of scope (later phases)

Frontend admin portal, DNS, Cloudflare, tenant onboarding emails, cross-tenant ticket access, slug rename.
