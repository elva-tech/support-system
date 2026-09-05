# Phase 7 — Multi-Portal Frontend Foundation

## Frontend architecture before / after

**Before:** Single Angular app assuming one ELVA org — staff shell, merchant portal, shared `elva_token`.

**After:** Same Angular app with hostname-driven portal selection:

| Host | Portal |
|------|--------|
| `admin.elvasupport.in` | Platform Administration |
| `{slug}.elvasupport.in` | Tenant Support Workspace |
| `localhost` | Tenant workspace (dev slug, default `elva`) or Platform via `portalMode: 'platform'` |

Route trees use Angular `canMatch` so `/dashboard` means Platform Dashboard or Tenant Dashboard depending on host — without duplicating the whole app.

## Portal detection strategy

Pure util: `src/app/core/portal/portal-host.util.ts`  
Service: `PortalContextService`

Resolution order:

1. Platform admin host (`admin.elvasupport.in`)
2. Localhost → `portalMode` / `developmentTenantSlug`
3. `{slug}.{tenantBaseDomain}` (reject reserved subdomains except `admin` → platform)
4. Otherwise `UNKNOWN` → invalid portal page

## Tenant context

`PortalContextService` exposes `portalType`, `tenantSlug`, `shouldSendTenantSlugHeader`.

No arbitrary tenant picker. No `tenantId` in localStorage.

## Authentication and token separation

| Identity | Storage keys | APIs |
|----------|--------------|------|
| Tenant staff | `tenant_access_token`, `tenant_user` (migrates from `elva_token`) | `/api/auth`, tenant resources |
| Platform admin | `platform_access_token`, `platform_admin_user` | `/api/platform/*` |
| Merchant | existing merchant session | `/api/merchant/*` |

## HTTP interceptor behavior

`jwtInterceptor`:

- Platform APIs → platform bearer only (never `X-Tenant-Slug`)
- Onboarding APIs → no bearer
- Merchant APIs → merchant interceptor
- Tenant APIs → tenant bearer + optional `X-Tenant-Slug` in non-production when `sendTenantSlugHeader` is true

`sessionExpiredInterceptor` redirects to the correct login for platform / staff / merchant.

## Platform Admin UI

- Login `/login`
- Shell nav: Dashboard, Businesses, Provision Business, Provisioning Status, Platform Admins, Audit Logs, Profile
- Role-aware nav (SUPPORT cannot provision)

## Tenant Management UI

`/tenants` — list, search, status filter, workspace URL, activate/suspend/cancel/archive (no delete, no slug edit).

## Provision Business UI

`/provision` → `POST /api/platform/tenants/provision`  
Shows step statuses and distinguishes email failure from overall `READY`.

## Provisioning Status UI

`/provisionings`, `/provisionings/:id` — retry + resend invitation.

## Tenant Workspace Integration

Existing staff shell and features remain; hostname selects tenant context; backend enforces isolation.

## Tenant Login

`/login` → `/auth/login` on tenant portal only. No tenant selector.

## Setup Account flow

`/setup-account?token=…` → validate + set password via onboarding APIs.

## Merchant compatibility

Merchant routes unchanged under tenant portal `canMatch`. `X-Merchant-Session` unchanged.

## Branding foundation

`BrandingService` — defaults for platform vs workspace; ready for `tenant.settings.branding` later.

## Local development

`environment.ts`:

```ts
portalMode: 'auto' | 'platform' | 'tenant'
developmentTenantSlug: 'elva'
sendTenantSlugHeader: true
```

- Tenant workspace locally: default (`auto` / `tenant`)
- Platform UI locally: set `portalMode: 'platform'` and restart `ng serve`

## Verification

```bash
npm run verify:portal
ng build --configuration development
```

## Known limitations

- No Angular unit-test runner configured (verification script covers host/API path rules)
- Dynamic per-tenant theming not implemented
- Platform admin create/edit UI is list-only (backend APIs exist for later)
- Real DNS / multi-host local routing not automated
