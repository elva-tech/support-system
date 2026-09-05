# Phase 8 — Tenant-Aware Operations

## 1. Operational architecture before Phase 8

Phases 1–7 delivered tenant workspaces, request-scoped isolation, platform admin, provisioning, and multi-portal frontend.

Operational systems (email, queues, notifications, workers, attachments) already had optional `tenantId` fields from Phase 3 backfill, but several **write and lookup paths still omitted tenant context**:

- `EmailThread.recordThreadMessage` did not set `tenantId`
- `InboundMailQueue.enqueueFromEmail` omitted `tenantId`
- `ClassificationQueue` creates omitted `tenantId`
- `MerchantProfile.findOne({ email })` was global (unsafe when the same email exists in multiple tenants)
- `Ticket.findOne({ ticketNumber })` was global
- Notification deliveries often lacked `tenantId`
- Attachment download used ticket ACL without request-tenant matching
- Mock storage paths were `{ticketNumber}/` only

## 2. Tenant propagation strategy

**Rule:** Tenant identity travels with the work. Workers never use `req.user` / `req.tenant`.

Preferred source of truth:

`Ticket.tenantId` → EmailThread / NotificationEvent / Delivery / Queue → Worker

Shared helpers live in `backend/src/shared/utils/tenant-ops.util.js`.

## 3. Outbound email tenant flow

`email-outbound.service.js`:

1. Resolve `tenantId` from ticket
2. Load tenant branding (`supportDisplayName`)
3. Send from central mailbox with display name: `{Support Display} <support@elvatech.in>`
4. Record `EmailThread` with `tenantId`

Notification worker builds the same thread metadata from the ticket (not HTTP).

## 4. Inbound email routing strategy

Central mailbox remains `support@elvatech.in` (no per-tenant SMTP).

Priority:

1. **Email thread headers** (`In-Reply-To` / `References`) → EmailThread → Ticket → `tenantId`
2. **Ticket reference** in subject/body (reject if the same number exists across tenants)
3. **Sender email** only when unique to one tenant
4. **Keywords** only after tenant is already known
5. Otherwise **UNRESOLVED / AMBIGUOUS** queue — never guess

## 5. Email thread tenant isolation

- Writes always resolve/set `tenantId` from ticket
- Header lookup fails safely if matches span multiple tenants/tickets
- Inbound processor records inbound threads with `result.tenantId`

## 6. Same-email-across-tenants handling

If `customer@gmail.com` exists in ABC and XYZ:

- Reply matched by thread → correct tenant
- New mail with only sender email → `routingStatus: AMBIGUOUS`, no ticket created

## 7. Inbound mail queue behavior

New fields:

- `routingStatus`: `RESOLVED | UNRESOLVED | AMBIGUOUS | FAILED`
- `routingReason`: short machine-readable reason

`tenantId` is set when known; intentionally nullable when unresolved/ambiguous.

Manual assign copies `tenantId` from the created ticket and marks routing `RESOLVED`.

## 8. Classification queue behavior

- Propagates `tenantId` from classification result / payload
- Ambiguous sender/ticket matches require manual handling
- Profiles are loaded tenant-scoped once tenant is known

## 9. Background worker context

Notification worker:

- Loads ticket by `event.entityId`
- Uses `event.tenantId || ticket.tenantId`
- Rejects tenant mismatch
- Skips delivery for non-operable tenants (`SUSPENDED` / `CANCELLED` / `ARCHIVED`)
- Passes `tenantId` into delivery records and email threads

## 10. Notification tenant propagation

- `createEvent(..., { tenantId })` used from ticket/conversation paths
- Deliveries accept `{ tenantId }`
- Platform concerns remain separate (`PlatformAuditLog`)

## 11. Email template tenant context

Templates accept optional `branding` / `supportDisplayName`.

- ELVA (`slug: elva`) → `ELVA Support`
- Other tenants → `{tenantName} Support`
- Physical From address stays the central support mailbox

No dynamic logo hosting in this phase.

## 12. Attachment / storage tenant isolation

New preferred path:

`{tenantSlug}/tickets/{ticketNumber}/...`

Legacy path still readable:

`{ticketNumber}/...`

Google Drive API uses a sanitized flat folder name derived from the same key.

Attachments remain owned via `ticketId` (no duplicate `tenantId` field).

## 13. Unresolved / ambiguous mail handling

Preserved in `inbound_mail_queue` with routing metadata. No auto-attach. Operator UI for unresolved mail is out of scope; backend data model is ready.

## 14. Tenant lifecycle considerations

For inbound replies that resolve to a non-operable tenant:

- Message is queued with `routingStatus: FAILED`
- `tenantId` preserved for audit
- No conversation / active workflow created

## 15. Database migrations

`20260905170000-phase8-operational-tenant-indexes.js`

- Indexes for inbound routing + tenant filters
- Classification queue tenant indexes
- Email thread tenant indexes

Idempotent; no destructive file migration.

## 16. Backward compatibility

- Existing ELVA records remain accessible
- Historical queues without routing fields default to `UNRESOLVED`
- Legacy attachment paths still download
- Existing ELVA email flows continue (verified in tests)

## 17. Security decisions

- Never route solely on ambiguous sender email
- Cross-tenant attachment ObjectId access → **404** (no existence leak)
- Attachment routes require tenant context + membership
- Workers validate ticket/event tenant alignment

## 18. Known limitations

- Tenant-specific recipient aliases (`abc+support@…`) not activated
- No full operator UI for unresolved mail
- Keyword auto-match without a known tenant is intentionally disabled
- Drive layout uses sanitized folder names rather than nested Drive folders
- Not every historical audit/notification call site was rewritten; ticket-driven paths are covered

## Phase 9 recommendations

- Operator console for unresolved/ambiguous inbound mail
- Optional plus-address / alias routing
- Full branding assets (logos) per tenant
- Tenant-scoped notification center / queue admin lists
- Deeper backfill / repair tooling for legacy operational rows missing `tenantId`
