# Phase 4 — Tenant Context & Isolation Foundation

Secure request-level tenant resolution and membership validation. Does **not** configure DNS, frontend subdomains, or Platform Admin.

## Tenant Resolution

Priority order:

1. **`X-Tenant-Slug`** — only when `TENANT_HEADER_OVERRIDE_ENABLED` is effective (default: enabled in development/test; **never honored in production**). In production, presence of this header returns `403 TENANT_OVERRIDE_FORBIDDEN`.
2. **Hostname** — `{slug}.{TENANT_BASE_DOMAIN}` (e.g. `abc.elvasupport.in` → `abc`).
3. **`TENANT_DEV_DEFAULT_SLUG`** — last resort for localhost/API hosts in non-production only (e.g. `elva`).

Reserved host labels (`admin`, `www`, `api`, …) never resolve as tenants (`INVALID_TENANT_HOST`).

Operable statuses: `ACTIVE`, `TRIAL`.  
Denied: `SUSPENDED`, `CANCELLED`, `ARCHIVED` → `TENANT_INACTIVE`.

## Request Context

After resolution:

```js
req.tenant = { _id, name, slug, status, resolutionSource? }
```

## Middleware Order (staff workspace APIs)

```text
authenticate
  → requireTenantContext
  → requireTenantMembership   // req.user.tenantId === req.tenant._id
  → authorize(roles)… / controllers
```

Merchant:

```text
requireTenantContext
  → merchantAuthenticate
  → requireMerchantTenantMembership
```

Public: `/api/auth/login`, `/health` — no tenant requirement.

## Membership

- Staff: JWT user `tenantId` must match `req.tenant._id`. No ADMIN cross-tenant bypass.
- Merchant: profile `tenantId` must match `req.tenant._id`.
- Client `tenantId` in body/query is stripped / ignored on writes.

## Tenant-Aware Writes & Queries (Phase 4 scope)

Scoped create/list/get/update for:

- Applications, Teams, Users, Tickets, MerchantProfiles (admin + OTP lookups)

Ticket access policy: **tenant filter first**, then existing ADMIN / TEAM_LEAD / AGENT rules.

## Ticket Sequence

Lookup key: `{ tenantId, applicationCode, year }`.  
Legacy unique `(applicationCode, year)` dropped by migration `20260905140000-…`.

## Application Code

Uniqueness: `{ tenantId, code }`.  
Global `code` unique dropped by migration `20260905141000-…`.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `TENANT_BASE_DOMAIN` | Apex for subdomain parsing (default `elvasupport.in`) |
| `TENANT_HEADER_OVERRIDE_ENABLED` | Allow `X-Tenant-Slug` outside production |
| `TENANT_REJECT_HEADER_IN_PRODUCTION` | Reject header in production (default true) |
| `TENANT_DEV_DEFAULT_SLUG` | Dev/test fallback slug (ignored in production) |

## CORS (future)

Authenticated APIs must not use `*`. Plan explicit origins for `https://*.elvasupport.in` (or dynamic reflection of allowed tenant hosts) — not enabled in Phase 4.

## Local Testing

```bash
# Header
curl -H "X-Tenant-Slug: elva" -H "Authorization: Bearer …" …

# Or rely on TENANT_DEV_DEFAULT_SLUG=elva with Host: localhost
```

## Next Phase

Platform Admin roles/host, full write-path coverage for queues/email/notifications, frontend subdomain deployment, production CORS for tenant hosts.
