# Phase 12 — Tenant Branding, Customization & White-Label Experience

## 1. Architecture overview

Phase 12 extends the Phase 9 workspace branding foundation into a runtime white-label presentation layer.

- **Storage:** `Tenant.settings.organization`, `Tenant.settings.branding`, `Tenant.settings.support`
- **Resolution:** Tenant hostname / `X-Tenant-Slug` context (never client-supplied `tenantId`)
- **Frontend:** `BrandingService` applies CSS variables + presentation state; `CustomerTerminologyService` maps UI labels
- **Email:** `buildEmailBranding()` + email layout use tenant logo URL, colors, and support display name with ELVA fallbacks
- **Platform portal:** Always ELVA defaults via `applyPlatformDefaults()`

## 2. Branding data model

```
settings.organization   // displayName, contacts, website, timezone, …
settings.branding
  supportDisplayName
  primaryColor          // #RGB | #RRGGBB
  secondaryColor
  loginTitle
  loginSubtitle
  faviconUrl            // future-ready (nullable / http(s) only)
  logoFileId / logoFileName / logoMimeType / logoStorageFolder
settings.support
  customerLabel         // CLIENT | CUSTOMER | MERCHANT (default CLIENT)
  supportEmailDisplayName // optional future-ready
```

`supportDisplayName` remains owned by `branding` (not duplicated in `support`).

## 3. Runtime theme system

Central defaults: `backend/src/shared/constants/default-branding.js` and `frontend/src/app/core/portal/default-branding.ts`.

Frontend CSS variables on `:root`:

| Variable | Purpose |
|----------|---------|
| `--tenant-primary-color` | Primary brand |
| `--tenant-secondary-color` | Accent |
| `--tenant-primary-hover` | Darkened primary |
| `--tenant-primary-light` | Light tint |

Applied by `BrandingService.applyCssVariables()` after public branding load. Invalid colors are rejected server-side and ignored client-side (hex only).

## 4. CSS variable strategy

- Shared components (`btn-primary`, `form-input:focus`, header background, nav active) use CSS variables
- Tailwind static `bg-elva-brand` is not rebuilt at runtime
- Platform portal resets to ELVA hex defaults

## 5. Platform vs tenant branding boundaries

| Surface | Branding source |
|---------|-----------------|
| `admin.elvasupport.in` | Always ELVA |
| `{slug}.elvasupport.in` | Tenant public branding |
| Setup account (`/onboarding`) | Invitation-validated branding payload (server-resolved) |

Never trust branding from query parameters.

## 6. Customer terminology system

Presentation-only. `MerchantProfile` and `/api/merchants` are unchanged.

Allowed: `CLIENT` (default), `CUSTOMER`, `MERCHANT`.

Frontend: `CustomerTerminologyService` exposes singular/plural/add/details/empty labels used by shell nav, merchants page, login links.

## 7. Email branding integration

`buildEmailBranding(tenant)` provides:

- `supportDisplayName`, `organizationName`
- `primaryColor` / `secondaryColor` (validated hex or ELVA default)
- `logoUrl` when logo exists (`{workspaceUrl}/api/workspace/branding/logo`)

Email layout uses these for header logo, hero gradient, footer org name. Failures never block send.

Central mailbox remains `support@elvatech.in` (display name only changes).

## 8. Public branding API

`GET /api/workspace/branding/public` (tenant context required, no staff JWT).

Safe fields include: `organizationName`, `supportDisplayName`, colors, login copy, `customerLabel`, `logoAvailable`, plus Phase 9 aliases (`displayName`, `hasLogo`, `tenantSlug`, …).

Does **not** expose secrets, admin data, internal settings blobs, or tenant ObjectIds.

Admin APIs:

- `PATCH /api/workspace/branding` — ADMIN
- `PATCH /api/workspace/support` — ADMIN
- Logo upload/delete unchanged (ADMIN)

## 9. Security model

1. Tenant A cannot read/modify Tenant B branding
2. Platform JWT cannot mutate workspace branding
3. TEAM_LEAD / AGENT cannot update branding/support
4. Client `tenantId` ignored
5. Invalid colors rejected
6. Cross-tenant logo access blocked
7. Public endpoint safe-field only
8. Null/missing tenant context fails closed via existing middleware

## 10. Audit events

| Action | When |
|--------|------|
| `WORKSPACE_BRANDING_UPDATED` | Branding PATCH |
| `WORKSPACE_LOGO_UPLOADED` / `WORKSPACE_LOGO_UPDATED` | Logo upload |
| `WORKSPACE_LOGO_DELETED` / `WORKSPACE_LOGO_REMOVED` | Logo delete |
| `WORKSPACE_SUPPORT_SETTINGS_UPDATED` | Support PATCH |
| `WORKSPACE_CUSTOMER_LABEL_UPDATED` | Customer label change |

No raw file contents logged.

## 11. Migration details

`backend/migrations/20260905200000-phase12-tenant-branding-defaults.js`

- Ensures `settings.support` exists
- Sets `customerLabel = CLIENT` when missing
- Does **not** overwrite Phase 9 branding

Run: `npm run migrate:up` in `backend`.

## 12. Testing performed

- Backend: `phase-12-tenant-branding.test.js` — **8/8 passed**
- Regression: `phase-9-workspace-setup.test.js` — **6/6 passed**
- Combined: **14/14 passed**
- Frontend production build: **succeeded**

## 13. Backward compatibility

- Phase 6–11 flows unchanged
- MerchantProfile naming unchanged
- Public branding keeps Phase 9 field aliases
- Incomplete branding falls back to ELVA defaults

## 14. Known limitations

- Favicon upload not implemented (nullable field only)
- Email logo depends on workspace origin reaching `/api/workspace/branding/logo`
- Terminology not yet applied to every historical “merchant” string in the codebase
- Custom domains / per-tenant mailboxes intentionally out of scope
