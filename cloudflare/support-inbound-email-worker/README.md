# Cloudflare setup — support@elvatech.in inbound

This Worker handles **only** `support@elvatech.in`. All other `elvatech.in` aliases keep their existing Email Routing rules unchanged.

## Architecture

```
Email → support@elvatech.in
         ↓
   Cloudflare Email Routing (support rule only)
         ↓
   elva-support-inbound Worker
         ├─→ forward copy → tech.elva@gmail.com
         └─→ POST webhook  → Render API /api/webhooks/inbound-email
```

Outbound mail (OTP, ticket notifications) stays on **Resend** from Render — not this Worker.

---

## Step 1 — Generate a shared secret

Run once locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the output. You will use the **exact same string** in:

| Where | Variable name |
|-------|----------------|
| Render API | `EMAIL_INBOUND_WEBHOOK_SECRET` |
| Cloudflare Worker | `INBOUND_WEBHOOK_SECRET` (wrangler secret) |

---

## Step 2 — Configure Render (API)

In [Render Dashboard](https://dashboard.render.com) → your API service → **Environment**:

| Variable | Value |
|----------|--------|
| `EMAIL_INBOUND_ENABLED` | `true` |
| `EMAIL_INBOUND_PROVIDER` | `webhook` |
| `EMAIL_INBOUND_WEBHOOK_SECRET` | *(secret from Step 1)* |
| `EMAIL_SUPPORT_ADDRESS` | `support@elvatech.in` |

You can remove or ignore `EMAIL_IMAP_*` on Render when using webhook — the IMAP poller is disabled automatically.

Click **Save** and **Manual Deploy** (or push to trigger deploy).

Verify after deploy:

```text
GET https://support-system-qhjr.onrender.com/health
```

Startup logs should mention: `Email inbound via Cloudflare webhook`.

---

## Step 3 — Deploy the Cloudflare Worker

### 3a. Install Wrangler (one time)

```bash
npm install -g wrangler
```

Or use `npx wrangler` without installing globally.

### 3b. Log in to Cloudflare

```bash
wrangler login
```

Opens browser — approve access for your Cloudflare account that owns `elvatech.in`.

### 3c. Deploy from this folder

```bash
cd cloudflare/support-inbound-email-worker
wrangler deploy
```

Default worker name: `elva-support-inbound` (from `wrangler.toml`).

### 3d. Set the webhook secret

```bash
wrangler secret put INBOUND_WEBHOOK_SECRET
```

Paste the **same secret** from Step 1 when prompted.

### 3e. Confirm vars in `wrangler.toml`

| Var | Default |
|-----|---------|
| `WEBHOOK_URL` | `https://support-system-qhjr.onrender.com/api/webhooks/inbound-email` |
| `GMAIL_FORWARD_ADDRESS` | `tech.elva@gmail.com` |

Edit `wrangler.toml` if your API URL differs, then run `wrangler deploy` again.

---

## Step 4 — Cloudflare Email Routing rule (support@ only)

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Select zone **elvatech.in**.
3. Go to **Email** → **Email Routing** → **Routing rules**.
4. Find the existing rule for **support@elvatech.in** (or create one).

**If support@ already forwards to Gmail:** edit that rule — do not add a second rule.

| Field | Value |
|-------|--------|
| Custom address | `support` @ `elvatech.in` |
| Action | **Send to a Worker** |
| Worker | `elva-support-inbound` |

5. Save.

**Do not:**

- Change MX records (Email Routing already set them up).
- Edit rules for `hello@`, `noreply@`, or any other alias.

---

## Step 5 — Test end-to-end

### 5a. Gmail copy

Send any email to `support@elvatech.in`. It should appear in `tech.elva@gmail.com` within a minute.

### 5b. Ticket reply

1. Create a ticket in ELVA Support (merchant portal).
2. Reply to the notification email from the merchant’s registered address.
3. The reply should appear on the ticket timeline in the agent UI.

### 5c. Unknown sender → inbound queue

Email `support@elvatech.in` from an address **not** in the merchant list. It should show in **Inbound Mail Queue** in the admin UI.

### 5d. Webhook auth check

```powershell
# Should return 401 Unauthorized
curl -X POST https://support-system-qhjr.onrender.com/api/webhooks/inbound-email `
  -H "Content-Type: application/json" `
  -d "{}"
```

### 5e. Manual webhook test (PowerShell)

```powershell
$mime = @"
From: stranger@example.com
To: support@elvatech.in
Subject: Test inbound
Message-ID: <local-test@mail>
Content-Type: text/plain; charset=utf-8

Hello from webhook test
"@
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($mime))

curl -X POST https://support-system-qhjr.onrender.com/api/webhooks/inbound-email `
  -H "Content-Type: application/json" `
  -H "X-Inbound-Webhook-Secret: YOUR_SECRET_HERE" `
  -d "{`"from`":`"stranger@example.com`",`"to`":`"support@elvatech.in`",`"rawMimeBase64`":`"$b64`"}"
```

Expected: `200` with `"action":"QUEUED"`.

---

## Local development vs production

| Environment | `EMAIL_INBOUND_PROVIDER` | How inbound works |
|-------------|--------------------------|-------------------|
| Local `.env` | `imap` | Polls Gmail via IMAP (no Cloudflare needed) |
| Render (prod) | `webhook` | Cloudflare Worker POSTs to API |

Use the same `EMAIL_INBOUND_WEBHOOK_SECRET` in `.env` as on Render so you can test the webhook with curl locally if needed.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Mail to support@ bounces | Email Routing not enabled, or Worker name mismatch in routing rule |
| Gmail gets mail, tickets don’t update | Check Render: `EMAIL_INBOUND_PROVIDER=webhook`, secret set, redeployed |
| Webhook `401` | Secret mismatch — re-run `wrangler secret put INBOUND_WEBHOOK_SECRET` and update Render |
| Webhook `503` | `EMAIL_INBOUND_ENABLED=false` or secret missing on Render |
| Other aliases stopped working | You changed a rule other than `support@` — restore it |
| Worker errors in CF logs | Dashboard → Workers → `elva-support-inbound` → Logs |

View Worker logs:

```bash
wrangler tail elva-support-inbound
```
