# Phase 3 — ELVA Tenant Data Backfill

Controlled introduction of `tenantId` ownership and backfill of all existing ELVA Support data to:

```text
Tenant: ELVA Technologies
Slug: elva
```

**Does not** enable tenant request isolation, subdomain routing, or JWT tenant claims.

## Architecture

```text
Tenant (ELVA Technologies)
├── User                    (direct tenantId)
├── Application             (direct tenantId)
│     └── Module            (inherited via Application — no tenantId field)
├── Team                    (direct tenantId)
├── MerchantProfile         (direct tenantId)
│     └── MerchantSession   (direct tenantId)
├── Ticket                  (direct tenantId)
│     ├── TicketConversation (inherited — no tenantId)
│     ├── Attachment         (inherited — no tenantId)
│     └── EmailThread        (direct tenantId — messageId lookups)
├── TicketSequence          (direct tenantId)
├── InboundMailQueue        (direct tenantId)
├── ClassificationQueue     (direct tenantId)
├── ApplicationProfile      (direct tenantId)
├── NotificationEvent       (direct tenantId)
├── NotificationDelivery    (direct tenantId)
└── AuditLog                (direct tenantId)

Not tenant-scoped in Phase 3:
- OtpSession (TTL / transient)
- Tenant itself
- changelog (migration metadata)
```

## Migration List

Run from `backend/` after Phase 2 (`create-tenants-and-seed-elva`) is applied.

| File | Purpose |
|------|---------|
| `20260905130000-add-tenantid-indexes-core.js` | Sparse `tenantId` indexes on core collections |
| `20260905131000-backfill-elva-tenant-core.js` | Backfill ELVA onto users, applications, teams, merchants, tickets, sequences |
| `20260905132000-merchant-email-unique-tenant-scoped.js` | Compound unique `(tenantId, email)`; drop global `email` unique |
| `20260905133000-ticket-sequence-tenant-unique.js` | Add unique `(tenantId, applicationCode, year)`; **keep** legacy unique |
| `20260905134000-add-tenantid-and-backfill-operational.js` | Indexes + backfill for email/queues/notifications/audit/sessions |

Helpers: `backend/src/shared/migration/tenant-backfill.js` (not a migrate-mongo file).

```bash
cd backend
npm run migrate:status
# Backup DB first in staging/production
npm run migrate:up
npm run migrate:status
```

## Backfill Strategy

1. Resolve ELVA by `slug: "elva"` (never hardcode ObjectId).
2. `updateMany` only where `tenantId` is missing or null.
3. Do not overwrite an existing `tenantId`.
4. Log and validate: before / updated / with ELVA / missing after.
5. Fail the migration if any target document still lacks `tenantId`.

## Merchant Index Migration (exact order)

Inspected production-like index name: `email_1` (unique on `email`).

1. Ensure every `merchantprofiles` document has `tenantId`.
2. Reject if duplicate `(tenantId, email)` groups exist.
3. Create unique `tenantId_1_email_1`.
4. Dynamically discover and drop any unique single-field `email` indexes.
5. Verify compound unique remains and legacy email unique is gone.

Merchant create/sync (`merchant.service.js`) sets `tenantId` from `application.tenantId` or the ELVA tenant so uniqueness stays coherent before request isolation exists.

## Ticket Sequence

- Backfilled `tenantId`.
- Added unique `(tenantId, applicationCode, year)`.
- **Preserved** unique `(applicationCode, year)` so `generateTicketNumber()` continues to work without tenant context.
- Sequences are **not** reset; `lastNumber` unchanged.

## Rollback

| Migration | `down` behavior |
|-----------|-----------------|
| indexes-core | Drops `tenantId_1` indexes only |
| backfill-core | Unsets `tenantId` only where it equals ELVA id |
| merchant-email | Restores `email_1` only if no cross-tenant duplicate emails; else fails loudly |
| ticket-sequence | Drops compound tenant unique; keeps legacy |
| operational | Unsets ELVA `tenantId` + drops `tenantId_1` |

If other tenants already exist with data, prefer **manual recovery** over automatic `down`.

## Backward Compatibility

- `tenantId` is **optional** in Mongoose schemas (not required).
- Existing APIs do not require tenant context.
- Login / OTP / tickets / attachments continue to use previous query shapes.
- No tenant middleware.

## Validation Checklist

After `migrate:up`:

- [ ] Every Application / User / Team / MerchantProfile / Ticket has ELVA `tenantId`
- [ ] Merchant indexes: `tenantId_1_email_1` unique present; `email_1` absent
- [ ] Ticket sequences retain `lastNumber`; numbering still increments
- [ ] Existing integration tests pass
- [ ] `migrate:up` second run is a no-op

## Next Phase

Phase 4 should update **creation paths** broadly (tickets, users, apps, notifications, audit) and introduce **tenant request isolation** (middleware + query scoping) — not done here.
