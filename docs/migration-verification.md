# Migration Verification Guide

Phase 15 companion. Migrations are **CLI-only** — never run on API startup.

## Commands

```bash
cd backend
npm run migrate:status
npm run migrate:up
npm run migrate:down   # use with extreme caution in production
```

Uses `MONGODB_URI` from environment / `.env`.

## Migration inventory (ordered)

| Timestamp | Purpose | Destructive? |
|-----------|---------|--------------|
| `20260905120000` | Tenants + ELVA seed | Additive |
| `20260905130000` | Core `tenantId` indexes | Additive |
| `20260905131000` | ELVA tenantId backfill (core) | Data write |
| `20260905132000` | Merchant email unique → tenant-scoped | Index swap |
| `20260905133000` | Ticket sequence tenant unique | Additive |
| `20260905134000` | Operational tenantId indexes + backfill | Data + indexes |
| `20260905140000` | Drop legacy ticket sequence unique | **Index drop** |
| `20260905141000` | Application code unique → tenant-scoped | Index swap |
| `20260905150000` | Platform admin collections | Additive |
| `20260905160000` | User email unique → tenant-scoped | Index swap |
| `20260905161000` | Provisioning collections | Additive |
| `20260905170000` | Phase 8 operational indexes | Additive |
| `20260905180000` | Phase 9 workspace setup backfill | Data additive |
| `20260905190000` | Phase 10 lifecycle + staff invitations | Data + indexes |
| `20260905195000` | Phase 11 audit indexes | Additive |
| `20260905200000` | Phase 12 branding defaults | Data additive |
| `20260905210000` | Phase 15 OTP session tenant indexes | Additive |

**Phase 13–14:** no migrations.  
**Phase 15:** one additive index migration for OTP tenant binding.

## Before deployment

1. Take a MongoDB backup ([backup-and-restore.md](./operations/backup-and-restore.md))
2. `npm run migrate:status` — note pending migrations
3. Inspect pending migration files in `backend/migrations/`
4. Confirm `APP_VERSION` / git SHA for the release

## Deployment

1. Run `npm run migrate:up` explicitly against production URI
2. `npm run migrate:status` — all applied
3. Confirm critical indexes (tenants.slug, users `{tenantId,email}`, tickets.tenantId, otpsessions `{email,tenantId}`)

## After deployment

1. Smoke platform portal
2. Smoke ELVA tenant
3. Smoke a second tenant
4. Spot-check isolation (tenant A token on tenant B host → denied)
5. Optional: platform integrity scan (SUPER_ADMIN)

## Rollback principles

- Application rollback ≠ automatic DB rollback
- Prefer **forward-fix** migrations for data/schema mistakes
- `migrate:down` only when the down script is reviewed and a backup exists
- Backfill `down` scripts assume earlier single-tenant ELVA contexts — unsafe on mature multi-tenant DBs

## Idempotency notes

- Seed/backfill migrations are designed to be re-run safely where possible
- Index migrations use named indexes; re-create is generally safe
- Do **not** rewrite historical migration files after they have been applied in any shared environment
