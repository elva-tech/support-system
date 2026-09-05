# Phase 2 — Tenant Foundation & Migration Infrastructure

Additive foundation for future multi-tenant PaaS. **Does not** attach existing data to tenants or enforce tenant isolation.

## 1. Migration System

Tool: [`migrate-mongo`](https://github.com/seppevs/migrate-mongo) (CommonJS), configured in `backend/migrate-mongo-config.js`.

Uses `MONGODB_URI` from the environment (same as the API; see `backend/.env.example`).  
Migrations are **not** run on application startup — they are intentional CLI operations.

| Command | Working directory | Purpose |
|---------|-------------------|---------|
| `npm run migrate:status` | `backend/` | List applied vs pending migrations |
| `npm run migrate:up` | `backend/` | Apply all pending migrations |
| `npm run migrate:down` | `backend/` | Roll back the last applied migration |

Changelog collection: `changelog` (created by migrate-mongo).  
Lock collection: `changelog_lock`.

```bash
cd backend
npm run migrate:status
npm run migrate:up
# only if you need to reverse the last migration:
npm run migrate:down
```

## 2. Tenant Model

Collection: `tenants`  
Module: `backend/src/modules/tenants/`

| Field | Type | Notes |
|-------|------|--------|
| `name` | String | Required, trimmed, max 200 |
| `slug` | String | Required, unique, lowercase, URL-safe |
| `status` | String | Lifecycle enum (default `ACTIVE`) |
| `settings` | Object | Foundation: `organization`, `branding`, `notifications` (empty objects) |
| `createdAt` / `updatedAt` | Date | Mongoose timestamps |

**Tenant ≠ Application.** Applications (ApnaCart, CMS, …) remain product entities and will nest under a Tenant in a later phase.

## 3. Tenant Lifecycle

Constants: `backend/src/shared/constants/tenant.js`

| Status | Meaning (foundation only) |
|--------|---------------------------|
| `ACTIVE` | Normal operation (default) |
| `TRIAL` | Trial workspace |
| `SUSPENDED` | Temporarily disabled |
| `CANCELLED` | Subscription/org cancelled |
| `ARCHIVED` | Retained but inactive |

No billing or access enforcement is implemented in Phase 2.

## 4. Slug Rules

- Normalized: **trim + lowercase** before validation.
- Pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` (letters, digits, single hyphens between segments).
- Unique across the `tenants` collection.

**Valid:** `elva`, `abc`, `abc-software`, `company123`  
**Invalid:** spaces, underscores, dots, leading/trailing hyphens, mixed case before normalization (input `ELVA` → `elva` is valid).

**Reserved** (cannot be used as tenant slugs):

`admin`, `www`, `api`, `mail`, `support`, `app`, `portal`, `static`, `assets`

These protect future platform hostnames. Subdomain routing is **not** implemented yet.

## 5. ELVA Seed

Migration: `backend/migrations/20260905120000-create-tenants-and-seed-elva.js`

Creates:

- Unique index on `slug`
- Index on `status`
- Tenant `{ name: "ELVA Technologies", slug: "elva", status: "ACTIVE" }` if missing

Idempotent: lookup by `slug: "elva"`; re-running `migrate:up` does not create duplicates.

Service helper (tests / internal use): `tenantService.ensureElvaTenant()`.

**Existing Users, Applications, Tickets, etc. are not linked to this tenant yet.**

## 6. Backward Compatibility

- No `tenantId` on existing collections.
- No public `/tenants` HTTP APIs.
- No auth/JWT/login changes.
- No ticket, merchant, or email behavior changes.
- Existing app continues to run without reading the `tenants` collection.

## 7. Next Phase

**Phase 3** will introduce controlled `tenantId` fields, ELVA data backfill, and uniqueness changes (e.g. merchant email scoped by tenant) — still without full request-time isolation until later phases.

## Domain errors

| Code | HTTP (service layer) |
|------|----------------------|
| `TENANT_NOT_FOUND` | 404 |
| `TENANT_SLUG_ALREADY_EXISTS` | 409 |
| `INVALID_TENANT_SLUG` | 400 |
| `RESERVED_TENANT_SLUG` | 400 |
| `INVALID_TENANT_STATUS` | 400 |
| `INVALID_TENANT_NAME` | 400 |
