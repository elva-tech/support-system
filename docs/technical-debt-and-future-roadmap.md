# Technical Debt and Future Roadmap

Phase 15 register. Distinguishes **required before production** vs **safe to defer**.

## REQUIRED BEFORE PRODUCTION

| Item | Status |
|------|--------|
| Cross-tenant ticket transfer team scoping | **Fixed in Phase 15** |
| Merchant OTP tenant binding | **Fixed in Phase 15** |
| Internal merchant sync tenant-scoped app lookup | **Fixed in Phase 15** |
| Logs-viewer JWT purpose rejection on tenant APIs | **Fixed in Phase 15** |
| Invitation token redaction in access logs | **Fixed in Phase 15** |
| IMAP poll not callable by arbitrary tenant ADMIN | **Fixed in Phase 15** |
| Production `LOG_OTP_TO_CONSOLE=false` | **Enforced via validate-env** |
| Production reject header policy | **Enforced via validate-env** |
| Backup taken before first prod migrate | Ops (checklist) |
| `TRUST_PROXY` set correctly behind LB | Ops (warn in validate-env; checklist required) |
| Platform admin bootstrap completed | Ops (`ensure:platform-admin`) |
| TLS + DNS for admin / `*.` / api (if Option B) | Ops (out of app scope) |

If all checklist items in [launch-readiness-checklist.md](./launch-readiness-checklist.md) are complete, there are **no known code-level blockers**.

---

## HIGH PRIORITY (production risks if scaling / misconfigured)

| Item | Notes |
|------|--------|
| Distributed rate limiting (Redis) | Required when running **multiple API instances** — current store is in-memory per process |
| Correct `TRUST_PROXY` hop count | Wrong value spoofs Host/IP; validate-env warns only |
| Staging backup/restore drill | Documented; must be practiced before relying on restores |
| Shared JWT secret across purposes | Mitigated by `identityType` / `purpose` claims; consider separate secrets later |

## MEDIUM PRIORITY (scaling / security improvements)

| Item | Notes |
|------|--------|
| Distributed metrics / Prometheus scrape | Optional; `/metrics` already exists behind internal key |
| Queue infrastructure (Bull/SQS) for mail/notifications | Workers are in-process pollers today |
| CSP hardening on SPA | Helmet CSP currently disabled for SPA flexibility |
| CDN for static Angular assets | Deployment topology choice |
| SIEM / log shipping | Prefer stdout → aggregator |
| Defense-in-depth re-scope ticket helpers | HTTP middleware already authorizes; soft `if (tenantId)` patterns remain |
| Option B Origin binding for non-browser clients | Residual mis-binding risk on public tenant endpoints |

## LOW PRIORITY (product enhancements)

| Item | Notes |
|------|--------|
| Per-tenant mailboxes | Explicitly out of scope historically |
| Custom domains | Out of scope |
| Favicon upload UI | Branding field exists; upload polish deferred |
| SLA configuration | Product |
| Billing / subscriptions | Explicitly out of scope |
| CAPTCHA on auth | Not required with rate limits |
| Grafana dashboards | Ops preference |

---

## SAFE TO DEFER (post-launch)

- Redis rate limits (until multi-instance)
- Full Grafana/Prometheus stack
- Per-tenant inbound mailboxes
- Custom domains / SSL automation
- Billing
- Mobile apps
- Major frontend redesign
- Automatic background integrity repair workers (keep SUPER_ADMIN manual repairs)

---

## Integrity scan cadence (recommended)

| Environment | Cadence |
|-------------|---------|
| Staging | After every migrate + weekly |
| Production | After migrate; weekly SUPER_ADMIN scan; after any restore |

Repairs remain SUPER_ADMIN-only with platform audit — no auto-repair workers.
