# Phase 10 — Secure Staff Lifecycle & Complete Tenant Isolation

## 1. Executive Summary

Phase 10 delivers:

1. **Secure staff invitation lifecycle** — Tenant ADMINs invite staff without creating or sharing passwords. Invitees set their own password via the existing `/setup-account` onboarding flow.
2. **User lifecycle states** — `INVITED | ACTIVE | SUSPENDED | DEACTIVATED`, enforced server-side, with `isActive` kept in sync for backward compatibility.
3. **Tenant isolation closure** — Dashboard, inbound mail queue, classification, notification center, audit listing, and omnichannel simulate are fully tenant-scoped.

Platform Admin provisioning invitations (`TenantAdminInvitation`) remain separate from staff invitations (`StaffInvitation`).

---

## 2. Existing User Flow Audit

| Area | Pre-Phase-10 behavior |
| ---- | --------------------- |
| User model | `isActive` boolean only; no lifecycle `status` |
| Create user | ADMIN supplied password; non-ADMIN received plaintext password email |
| Auth | Login and JWT middleware blocked when `isActive === false` |
| Phase 6 | Tenant admin invitations already used hashed tokens + unusable password + setup link |

**Conclusion:** Password-based staff creation was still the admin UX. Phase 10 replaces it with invitation tokens, reusing Phase 6 token utilities.

---

## 3. Staff Invitation Architecture

```
Tenant ADMIN → POST /api/users/invite
  → User(status=INVITED, isActive=false, unusable password)
  → StaffInvitation(tokenHash only, PENDING, expiry)
  → Tenant-branded invitation email with setup link
  → Invitee opens /setup-account?token=...
  → Sets password → ACTIVE → login on https://{slug}.{TENANT_BASE_DOMAIN}
```

`StaffInvitation` is distinct from `TenantAdminInvitation` (platform provisioning). Both share:

- `invitation-token.util.js` (generate/hash/expiry/URLs)
- Public `/api/onboarding` validate + complete-setup (dual-path by token hash)

---

## 4. User Lifecycle States

| Status | Login | API access | Notes |
| ------ | ----- | ---------- | ----- |
| INVITED | No | No | Pending setup |
| ACTIVE | Yes | Yes | Normal operation |
| SUSPENDED | No | No | Temporary lock |
| DEACTIVATED | No | No | Permanent off |

`isActive` is synchronized: `ACTIVE → true`, others → `false`. Auth uses `isUserLoginAllowed()`.

---

## 5. Invitation Token Security

- Cryptographically random 32-byte hex tokens
- SHA-256 hash stored; raw token never persisted
- Single-use; hash rotated on accept
- Expiry enforced (`TENANT_INVITATION_EXPIRY_HOURS`)
- Resend revokes previous PENDING invitations
- Raw tokens never returned from list/admin APIs
- Raw tokens never logged

---

## 6. APIs

| Method | Path | Role | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/api/users/invite` | ADMIN | Invite staff |
| POST | `/api/users` | ADMIN | Same as invite (no password) |
| POST | `/api/users/:id/resend-invitation` | ADMIN | Resend |
| POST | `/api/users/:id/revoke-invitation` | ADMIN | Revoke + deactivate invitee |
| POST | `/api/users/:id/suspend` | ADMIN | Suspend |
| POST | `/api/users/:id/reactivate` | ADMIN | Reactivate (not from INVITED) |
| POST | `/api/users/:id/deactivate` | ADMIN | Deactivate |
| GET | `/api/onboarding/invitation/:token` | Public | Validate (admin or staff) |
| POST | `/api/onboarding/complete-setup` | Public | Set password |
| GET | `/api/audit` | ADMIN | Tenant-scoped audit list |

Tenant identity always from `req.tenant` (never client `tenantId`).

---

## 7. Authorization Rules

- **Tenant ADMIN:** invite, resend, revoke, suspend, reactivate, deactivate, manage staff
- **TEAM_LEAD / AGENT:** cannot manage users or lifecycle
- **No Platform Admin bypass** on tenant staff APIs

---

## 8. Email Flow

Uses existing `NotificationManager` + `onboarding-email.service` + tenant branding (`buildEmailBranding`).

New template: `renderStaffInvitationEmail` — organization name, workspace URL, role, setup link, expiry.

---

## 9. Frontend Changes

- Users page: **Invite User** (no password fields)
- Lifecycle actions: Resend / Revoke / Suspend / Reactivate / Deactivate
- Search + status filter
- `/setup-account` supports staff and tenant-admin invitations

---

## 10. Tenant Isolation Audit Findings

| Module | Pre-Phase-10 gap |
| ------ | ---------------- |
| Dashboard | Unscoped Ticket/Team/User/Notification queries |
| Inbound mail | Unscoped list/get/assign/reject |
| Classification | Unscoped profiles/queue; body `tenantId` trusted |
| Notification center | Unscoped summary/deliveries/pending |
| Audit | Write-only; often missing tenant on some paths; no tenant list API |
| Omnichannel simulate | No membership; client could supply tenantId |

---

## 11–14. Isolation Fixes

- **Dashboard:** all metrics/aggregations filtered by `req.tenant._id`; conversation counts via ticket `$lookup`
- **Inbound mail:** tenant guards + `withTenantFilter`; null-`tenantId` rows fail closed
- **Classification:** tenant guards; HTTP uses `req.tenant`; workers may pass persisted `tenantId`
- **Notifications:** tenant-scoped list/summary
- **Audit:** `GET /api/audit` tenant-scoped; PlatformAuditLog unchanged

---

## 15. Legacy Records Handling

Collections that may still have `tenantId: null` (inbound queue, classification queue, notifications, audit):

- **Tenant APIs:** fail closed (ObjectId filter never matches null)
- **No automatic ownership guessing**
- Operators may manually stamp ownership when known safe
- Unresolved null rows remain invisible to tenants (documented limitation)

---

## 16. Tenant Isolation Matrix

| Module | Read Scoped | Write Scoped | ObjectId Protected | Worker Safe | Tests |
| ------ | ----------- | ------------ | ------------------ | ----------- | ----- |
| Applications | Yes | Yes | Yes | N/A | Yes |
| Teams | Yes | Yes | Yes | N/A | Yes |
| Users / Staff invite | Yes | Yes | Yes | N/A | Yes |
| Tickets | Yes | Yes | Yes | Yes | Yes |
| Dashboard | Yes | N/A | Yes | N/A | Yes |
| Inbound Mail | Yes | Yes | Yes | Yes | Yes |
| Classification | Yes | Yes | Yes | Yes | Yes |
| Notifications | Yes | Yes | Yes | Yes | Yes |
| Audit (tenant) | Yes | Yes | Yes | N/A | Yes |
| Platform Audit | Separate | Separate | N/A | N/A | Yes |
| Omnichannel simulate | Yes | Yes | Yes | N/A | Yes |
| Modules | Via Application | Via Application | Yes | N/A | Yes |

---

## 17. Database Migrations

`20260905190000-phase10-user-lifecycle-and-staff-invitations.js`

- Creates `staffinvitations` indexes
- Backfills `User.status`: pending invites → `INVITED`; `isActive` true → `ACTIVE`; else → `DEACTIVATED`
- Idempotent; existing active users never become INVITED

---

## 18. Security Considerations

- Invitation tokens hashed, single-use, expiring
- Lifecycle enforced in login + JWT middleware
- No admin plaintext passwords for invites
- No client-controlled tenantId on tenant APIs
- Cross-tenant ObjectIds → 404
- Aggregations include tenant match early

---

## 19–20. Tests Performed / Results

- `phase-10-staff-lifecycle-and-isolation.test.js` — **PASS**
- Related: platform-admin, tenant-provisioning, phase-8 (after classify fix), phase-9, tenant-isolation, inbound-mail-queue, classification, omnichannel — **PASS** (phase-8 classify regression fixed)

---

## 21. Backward Compatibility

- Existing ACTIVE users keep working (`status` default/backfill ACTIVE)
- `isActive` retained and synced
- Phase 6 tenant-admin invitation flow unchanged (dual-path onboarding)
- Legacy welcome-with-password emails remain in codebase but are unused by invite path

---

## 22. Known Limitations

- Unresolved `tenantId: null` inbound/classification rows stay invisible to tenant admins (by design)
- Global IMAP `email/poll` still polls shared inbox (membership-gated only)
- No tenant UI for audit log yet (API only)
- Modules collection still inherits tenant via Application parent (no direct `tenantId` field)

---

## 23. Recommendations for Phase 11

- Optional audit log UI in tenant workspace
- Safe tooling to repair null-tenant queue ownership when provenance exists
- Per-tenant inbound routing / mailbox isolation
- Soft-delete retention policies for DEACTIVATED users
- Team-scoped invite permissions for TEAM_LEAD (if product requires)
