# Deployment Rollback

Phase 14 companion to [production-checklist.md](./production-checklist.md).

## Application rollback

1. Identify previous known-good artifact (image tag / build / commit).
2. Redeploy previous artifact with the **same** production env snapshot (except intentional fixes).
3. Verify:
   - `GET /health` → `ok`
   - `GET /health/ready` → `ready`
   - Platform + one tenant login
4. Confirm startup log `version` / `gitSha` matches expected rollback target.

## Database migration rollback

- migrate-mongo `down` scripts are **not** automatically safe in production.
- If a migration has not been applied, simply redeploy the app.
- If a migration **has** been applied:
  - Prefer a **forward-fix** migration that corrects data/schema.
  - Use `migrate:down` only when the down script is reviewed, data loss is accepted, and a backup exists.

## Safe migration principles

1. Backup before every `migrate:up` ([backup-and-restore.md](../operations/backup-and-restore.md)).
2. Migrations are intentional CLI — never on API startup.
3. Expand/contract: add fields nullable first; remove later.
4. Avoid destructive renames without dual-read windows.

## Forward-fix vs rollback decisions

| Situation | Prefer |
|-----------|--------|
| App bug, no schema change | Application rollback |
| Schema expanded, app incompatible | Forward-fix app **or** compatible rollback build |
| Data backfill wrong | Forward-fix data script |
| Catastrophic corruption | Restore from backup (accept data loss window) |

## Tenant data considerations

- Shared database with `tenantId` isolation — restores affect **all** tenants.
- After restore, run integrity checks and spot-check multiple tenants.
- Do not attempt per-tenant dump restore unless tooling explicitly supports it (not provided by Phase 14).

## Verification after rollback

- [ ] Health + readiness
- [ ] Auth (platform + tenant + merchant OTP smoke)
- [ ] Inbound webhook auth still valid
- [ ] No surge of `INTERNAL_ERROR` / security events
- [ ] Version metadata matches rollback target

## Phase 14 note

**No database migration is required for Phase 14.** Rolling back Phase 14 is an application-only rollback.
