# ELVA Support — Notification Integration (Phase 6.5)

ELVA Support delegates **delivery only** to ELVA Notify. OTP generation, storage, verification, and merchant sessions remain owned by ELVA Support.

## Architecture

```
NotificationManager
    ├── ElvaNotifyProvider (primary)
    └── FallbackProvider (log-based fallback)
```

### Flow: OTP

1. Merchant requests OTP → `merchant.service` generates and stores OTP
2. `NotificationManager.sendOtp()` called
3. `ElvaNotifyProvider` → `POST {ELVA_NOTIFY_API_URL}/otp/send`
4. On failure (if `NOTIFICATION_FALLBACK_ENABLED=true`) → `FallbackProvider` logs OTP
5. Delivery recorded in `notification_deliveries`

### Flow: Ticket notifications

1. Ticket action creates `notification_events` (via audit or explicit hooks)
2. `NotificationWorker` polls unprocessed events
3. `NotificationManager.sendNotification()` delivers via ELVA Notify → fallback
4. Event marked `processed: true`

## Worker event types

| Event | Source |
|-------|--------|
| `TICKET_CREATED` | Audit on merchant ticket create |
| `AGENT_REPLY` | Agent reply hook in conversation service |
| `STATUS_CHANGED` | Audit on status change (skipped when resolving — see `TICKET_RESOLVED`) |
| `TICKET_RESOLVED` | Status change to `RESOLVED` |

## Provider interface

All providers implement:

- `sendOtp({ email, phone, otp, channel, expiresInMinutes })`
- `sendNotification({ eventType, recipientEmail, recipientPhone, subject, body, metadata })`

**Future providers:** SMTP, Fast2SMS, MSG91, Gupshup

## ELVA Notify API contract

### `POST /otp/send`

```json
{
  "channel": "email",
  "email": "merchant@example.com",
  "phone": null,
  "otp": "123456",
  "expiresInMinutes": 10
}
```

Headers: `X-Api-Key: {ELVA_NOTIFY_API_KEY}`

### `POST /notifications/send`

```json
{
  "eventType": "TICKET_CREATED",
  "email": "merchant@example.com",
  "phone": null,
  "subject": "Ticket APN-2026-000001 created",
  "body": "Your support ticket ...",
  "metadata": { "ticketId": "...", "ticketNumber": "APN-2026-000001" }
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTIFICATION_PROVIDER` | `ELVA_NOTIFY` | Primary provider identifier |
| `NOTIFICATION_FALLBACK_ENABLED` | `true` | Use FallbackProvider on primary failure |
| `NOTIFICATION_WORKER_ENABLED` | `true` | Start background worker |
| `NOTIFICATION_WORKER_POLL_MS` | `5000` | Poll interval |
| `NOTIFICATION_WORKER_BATCH_SIZE` | `10` | Events per poll |
| `ELVA_NOTIFY_API_URL` | — | ELVA Notify base URL |
| `ELVA_NOTIFY_API_KEY` | — | API key for ELVA Notify |
| `ELVA_NOTIFY_TIMEOUT_MS` | `10000` | HTTP timeout |

## Collections

### `notification_deliveries`

```json
{
  "eventId": "ObjectId | null",
  "provider": "ELVA_NOTIFY | FALLBACK",
  "status": "SUCCESS | FAILED",
  "errorMessage": "string | null",
  "attemptedAt": "Date"
}
```

### `notification_events` (existing)

Queued events with `processed: false` until the worker delivers them.

## Development

Without `ELVA_NOTIFY_API_URL`, the primary provider fails and **FallbackProvider** logs OTP and notifications to the console. Set `EXPOSE_OTP_IN_RESPONSE=true` only in local dev if the merchant UI needs the OTP.

## SMS (future)

`sendOtp()` accepts `channel: "sms"` and `phone`. Wire ELVA Notify SMS routing when available; no SMS provider is implemented in ELVA Support.
