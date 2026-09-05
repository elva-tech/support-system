# Backup and Restore Runbook

Phase 14 operational guide. **No application-level MongoDB dumps** — backups are infrastructure/ops.

## 1. MongoDB backup strategy

Supported options (pick one primary):

| Option | Notes |
|--------|--------|
| **MongoDB Atlas continuous backup** | Preferred if Atlas is used; PITR where available |
| **mongodump / scheduled snapshots** | Self-hosted or VM-backed MongoDB |
| **Cloud provider disk snapshots** | Supplement only — prefer logical dumps for restore flexibility |

Do **not** embed backup jobs inside the Node.js API process.

## 2. Frequency recommendations

- **Production:** continuous or at least daily full + frequent oplog/PITR if available
- **Before migrations:** mandatory snapshot / dump labeled with git SHA / APP_VERSION
- **Before major releases:** additional pre-cutover backup

## 3. Retention recommendations

- Daily backups: ≥ 7–14 days
- Weekly backups: ≥ 4–8 weeks
- Pre-migration backups: retain until migration is verified in production (min 14 days)

## 4. Encryption and storage

- Encrypt backups at rest
- Restrict access to ops/break-glass roles only
- Store off-host (separate account/region when practical)
- Never commit dumps or connection strings to git

## 5. Restore procedure (high level)

1. Declare incident / maintenance window if customer-facing.
2. Identify backup: timestamp, environment, APP_VERSION / GIT_SHA.
3. Provision restore target (prefer restore to **new** cluster/DB first).
4. Restore dump / Atlas restore into target.
5. Point a **staging** API at the restored DB; do not flip production DNS yet.
6. Run verification (section 6–7).
7. Only then cut over application `MONGODB_URI` (or promote restored cluster).

## 6. Restore verification

- `GET /health` → `ok`
- `GET /health/ready` → `ready`
- Platform admin login
- Sample tenant workspace login (`{slug}.elvasupport.in`)
- Spot-check tickets, merchants, invitations for a known tenant
- Confirm migrations status: `npm run migrate:status`

## 7. Tenant data integrity after restore

- Platform integrity tooling (Phase 11) against restored data when available
- Confirm no cross-tenant `tenantId` anomalies for spot-checked collections
- Confirm ELVA tenant and a second tenant both resolve independently

## 8. Migration considerations

- Application rollback ≠ automatic DB rollback
- Data migrations may be **forward-fix only**
- Always backup before `migrate:up`
- Record migrate status in the incident ticket

## 9. Rollback limitations

- Restoring an older dump can **lose** writes after backup time
- Do not assume every migrate-mongo down script is safe in production
- Prefer forward recovery (fix-forward migration + hotfix) when data was written under a new schema

## Explicit non-actions

- No DNS changes in this runbook alone
- No automatic dumps from the API
- No credentials in this document
