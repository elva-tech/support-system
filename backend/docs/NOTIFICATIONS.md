# ELVA Support — Notification Integration (Phase 6.5)

ELVA Support sends email **directly via SMTP** so the FROM address can be `support@elvatech.in`. OTP generation, storage, verification, and merchant sessions remain owned by ELVA Support (relay mode).

## Architecture

```
NotificationManager
    ├── SmtpProvider (primary — ticket emails, onboarding, OTP relay)
    ├── ElvaNotifyProvider (optional — legacy or native OTP mode only)
    └── FallbackProvider (log-based fallback for dev/disaster recovery)
```

### Flow: OTP (relay mode — default)

1. Merchant requests OTP → `merchant.service` generates and stores OTP
2. `NotificationManager.sendOtp()` called
3. `SmtpProvider` sends from `support@elvatech.in` via SMTP
4. On failure (if `NOTIFICATION_FALLBACK_ENABLED=true`) → `FallbackProvider` logs OTP
5. Delivery recorded in `notification_deliveries`

### Flow: Ticket notifications

1. Ticket action creates `notification_events` (via audit or explicit hooks)
2. `NotificationWorker` polls unprocessed events
3. `NotificationManager.sendNotification()` delivers via SMTP → fallback
4. Event marked `processed: true`

Timeline replies use `email-outbound.service` with threaded headers (`Message-ID`, `In-Reply-To`, `References`).

## Environment

| Variable | Purpose |
|----------|---------|
| `NOTIFICATION_PROVIDER` | `SMTP` (default) or `ELVA_NOTIFY` (legacy) |
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | `587` (STARTTLS) or `465` (SSL) |
| `SMTP_USER` | Mailbox user, defaults to `EMAIL_IMAP_USER` |
| `SMTP_PASS` | App password, defaults to `EMAIL_IMAP_PASSWORD` |
| `EMAIL_SUPPORT_ADDRESS` | From/reply-to address (`support@elvatech.in`) |
| `SMTP_FROM_NAME` | Display name (default: ELVA Support) |

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
- `sendEmail({ to, subject, html, headers, replyTo, from })`

**Future providers:** Fast2SMS, MSG91, Gupshup

## ELVA Notify (optional legacy)

Set `NOTIFICATION_PROVIDER=ELVA_NOTIFY` only if you still route through ELVA Notify. Note: ELVA Notify does **not** honor custom FROM addresses — use SMTP for support mailbox branding.

Native OTP mode (`ELVA_NOTIFY_OTP_MODE=native`) still uses ELVA Notify for OTP send/verify/resend when configured with an approved `brandId`.
