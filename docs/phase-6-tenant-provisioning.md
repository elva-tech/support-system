# Phase 6 — Automated Tenant Provisioning & Tenant Admin Onboarding

## Provisioning Architecture

```text
Platform Admin
      │
      ▼
POST /api/platform/tenants/provision
      │
      ├─ Create Tenant
      ├─ Create TenantProvisioning (tracked)
      ├─ Initialize workspace defaults
      ├─ Create tenant User (role ADMIN, isActive: false)
      ├─ Create TenantAdminInvitation (token hashed)
      ├─ Queue/send welcome email
      └─ Mark READY (email failure does not roll back tenant)
```

Low-level `POST /api/platform/tenants` remains for manual tenant metadata management. Prefer `/tenants/provision` for business onboarding.

## TenantProvisioning Model

Collection: `tenantprovisionings`

Tracks: `tenantId`, slug/name, platform actor, admin identity, workspace URL, status, steps, failure, timestamps.

One provisioning record per tenant (`tenantId` unique).

## Provisioning States

| Status | Meaning |
|--------|---------|
| `PENDING` | Record created, not started |
| `IN_PROGRESS` | Pipeline running |
| `READY` | Core onboarding complete (tenant + admin + invitation) |
| `FAILED` | Core step failed |

Tenant `status` (ACTIVE/TRIAL/…) remains separate.

## Provisioning Steps

```text
tenantCreated → workspaceInitialized → adminCreated → invitationCreated → welcomeEmail
```

Each step: `PENDING | COMPLETED | FAILED | SKIPPED` with optional `completedAt` / `error`.

## Tenant Admin Creation

- Normal tenant `User` with `role: ADMIN`
- `tenantId` = new tenant
- `isActive: false` until invitation acceptance
- Password set to unusable random value (required by schema); real password set on setup
- Client cannot choose role or password

## Invitation Architecture

Collection: `tenantadmininvitations`

Fields: `tenantId`, `userId`, `email`, `tokenHash`, `status`, `expiresAt`, `acceptedAt`, `createdByPlatformAdminId`, `provisioningId`

Statuses: `PENDING | ACCEPTED | EXPIRED | REVOKED`

## Token Security

1. Generate 32-byte hex raw token
2. Store SHA-256 hex hash only
3. Send raw token only in invitation URL
4. Single-use; hash rotated on accept
5. Default expiry: 72 hours (`TENANT_ADMIN_INVITATION_EXPIRY_HOURS`)
6. Never logged; never returned from platform APIs

## Account Setup Flow

```text
GET  /api/onboarding/invitation/:token  → { valid, tenantName, tenantSlug, adminName, ... }
POST /api/onboarding/complete-setup     → { token, password, confirmPassword? }
```

On success: hash password, set `isActive: true`, mark invitation `ACCEPTED`.

## Workspace URL Generation

```text
{TENANT_WORKSPACE_PROTOCOL}://{slug}.{TENANT_BASE_DOMAIN}
```

Example: `https://abc.elvasupport.in`

Invitation URL:

```text
{workspaceUrl}{TENANT_ONBOARDING_PATH}?token={rawToken}
```

Default path: `/setup-account`

No DNS or Cloudflare automation in this phase.

## Welcome Email

Uses existing `NotificationManager` (Resend / SMTP / fallback).

Template: `renderTenantAdminInvitationEmail`.

Sender remains central ELVA Support (`support@elvatech.in`).

## Email Failure Behavior

If email fails:

- Tenant, admin, and invitation **remain**
- Provisioning status still `READY` when core steps completed
- `steps.welcomeEmail.status = FAILED`
- Use resend or retry

## Retry and Resend Behavior

| Endpoint | Behavior |
|----------|----------|
| `POST .../provisionings/:id/retry` | Resume failed/pending steps; no duplicate tenant/admin |
| `POST .../provisionings/:id/resend-invitation` | Revoke pending invitations, issue new token, send email |

## User Email Uniqueness Decision

**Changed:** User email uniqueness is now **tenant-scoped**.

| Before | After |
|--------|-------|
| Global unique `email` | Unique `{ tenantId, email }` |

**Auth change:** `POST /api/auth/login` requires tenant context (`requireTenantContext`) and looks up `User` by `{ email, tenantId }`.

Same email may exist in different tenants; not within one tenant.

Existing ELVA users continue to work via `TENANT_DEV_DEFAULT_SLUG` / hostname / `X-Tenant-Slug` (dev).

## Security Boundaries

- Only `PLATFORM_SUPER_ADMIN` / `PLATFORM_ADMIN` may provision
- `PLATFORM_SUPPORT` may list provisionings, not create
- Tenant JWT cannot call platform APIs
- Invited admin cannot login until setup
- Invitation tokens hashed, expiring, single-use

## API Reference

### Platform

```text
POST /api/platform/tenants/provision
GET  /api/platform/provisionings
GET  /api/platform/provisionings/:provisioningId
POST /api/platform/provisionings/:provisioningId/retry
POST /api/platform/provisionings/:provisioningId/resend-invitation
```

### Public onboarding

```text
GET  /api/onboarding/invitation/:token
POST /api/onboarding/complete-setup
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TENANT_BASE_DOMAIN` | `elvasupport.in` | Workspace hostname (reused from Phase 4) |
| `TENANT_WORKSPACE_PROTOCOL` | `https` | URL scheme |
| `TENANT_ONBOARDING_PATH` | `/setup-account` | Frontend setup path |
| `TENANT_ADMIN_INVITATION_EXPIRY_HOURS` | `72` | Invitation TTL |

## Operational Recovery

1. Email failed → `resend-invitation`
2. Admin create failed → `retry` (tenant already exists)
3. Duplicate provision click → 409; no duplicate entities
4. Expired invitation → `resend-invitation`

## Migrations

```text
20260905160000-user-email-unique-tenant-scoped.js
20260905161000-create-tenant-provisioning-collections.js
```

```bash
npm run migrate:up
```

## Out of scope

Frontend portals, DNS, Cloudflare, custom domains, billing, per-tenant email branding.
