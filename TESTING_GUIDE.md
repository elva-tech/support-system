# ELVA Support — Complete Testing Guide

Follow this in order: **configure → start servers → create setup in UI → test each view → run the end-to-end flow**.

---

## Part 1 — Before you test (configuration)

### 1.1 Prerequisites

| Requirement | What you need |
|-------------|---------------|
| Node.js | v20 or higher (`node -v`) |
| MongoDB | Atlas URI in `backend/.env` |
| Browsers | Chrome/Edge; use two tabs (merchant + staff) |
| ELVA Notify | For real OTP emails |

### 1.2 Backend `.env`

Confirm these in `backend/.env`:

```
PORT=3000
MONGODB_URI=...
CORS_ORIGIN=http://localhost:4200
ADMIN_EMAIL=arun.pn@elvatech.in
ADMIN_PASSWORD=Admin@123
SEED_MERCHANT_EMAIL=arun.pn@elvatech.in
LOG_OTP_TO_CONSOLE=true
ELVA_NOTIFY_OTP_MODE=relay
ELVA_NOTIFY_API_URL=https://api.notify.elvatech.in
ELVA_NOTIFY_APP_ID=eNandi
ELVA_NOTIFY_API_KEY=eNandi_123
ELVA_NOTIFY_BRAND_ID=elva-support
```

Optional for local testing:

```
SEED_TEAM_LEAD_EMAIL=lead@apnacart.support
SEED_TEAM_LEAD_PASSWORD=Lead@12345
SEED_AGENT_EMAIL=agent@apnacart.support
SEED_AGENT_PASSWORD=Agent@12345
API_BASE_URL=http://localhost:3000
GOOGLE_DRIVE_MOCK=true
```

You do **not** need for UI testing:

- `EMAIL_IMAP_*` — no UI for email inbox yet
- Frontend `.env` — local dev uses `http://localhost:3000/api` automatically

### 1.3 Install dependencies (once)

```powershell
cd "c:\Users\ADMIN\Downloads\Elva\Support system\backend"
npm install

cd "c:\Users\ADMIN\Downloads\Elva\Support system\frontend"
npm install
```

### 1.4 Start both servers (admin is created automatically)

When the backend starts, it ensures the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` exists. **No seed command** — applications, teams, and merchants are created only through the admin UI.

**Terminal 1 — Backend:**

```powershell
cd "c:\Users\ADMIN\Downloads\Elva\Support system\backend"
npm run dev
```

**Terminal 2 — Frontend:**

```powershell
cd "c:\Users\ADMIN\Downloads\Elva\Support system\frontend"
npm start
```

### 1.6 Verify everything is up

| Check | URL | Expected |
|-------|-----|----------|
| API health | http://localhost:3000/health | `{"status":"ok",...}` |
| Live logs (OTP) | http://localhost:3000/ | Log viewer |
| App | http://localhost:4200 | Landing page |

---

## Part 2 — Test accounts

| Role | Email | Password / OTP |
|------|-------|----------------|
| Admin | arun.pn@elvatech.in | Admin@123 |
| Team Lead | lead@apnacart.support | Lead@12345 |
| Agent | agent@apnacart.support | Agent@12345 |
| Agent 2 | agent2@apnacart.support | Agent@12345 |
| Merchant | arun.pn@elvatech.in | OTP to inbox (or backend console) |

**OTP tip:** Open http://localhost:3000/ or backend terminal when `LOG_OTP_TO_CONSOLE=true`.

---

## Part 3 — All views (step by step)

Base URL: **http://localhost:4200**

Use **Tab A** for merchant, **Tab B** for staff.

### A. Public views (no login)

#### 1. Landing page — `/`

1. Open http://localhost:4200
2. Verify hero, “How it works”, feature cards
3. **Sign in to your account** → `/merchant/login`
4. **Agent or admin access** → `/auth/login`

#### 2. Merchant login — `/merchant/login`

1. Enter `arun.pn@elvatech.in` → **Send OTP**
2. Verify redirect to `/merchant/verify-otp`
3. Negative: `unknown@test.com` → error, no redirect

#### 3. Merchant OTP verify — `/merchant/verify-otp`

1. Enter 6-digit OTP
2. Verify redirect to `/merchant/dashboard`
3. Wrong OTP → error

#### 4. Staff login — `/auth/login`

1. Login as Admin, Agent, Team Lead
2. Verify redirect to `/dashboard`
3. Sign out returns to landing

### B. Merchant portal

Tabs: **Dashboard | New Ticket | My Tickets**

#### 5. Merchant dashboard — `/merchant/dashboard`

- Store name, Open/Resolved/Closed stats, application info

#### 6. New ticket — `/merchant/tickets/new`

1. Module: **Orders**
2. Subject: `Test order not delivered`
3. Description: `Order #12345 shows pending for 3 days`
4. Submit → ticket detail with `APN-2026-XXXXXX`

#### 7. My tickets — `/merchant/tickets`

- List shows created ticket; click row for detail

#### 8. Merchant ticket detail — `/merchant/tickets/:id`

- Timeline, reply, optional attachment upload

### C. Staff portal — Admin

Sidebar: all items (Dashboard through Users).

#### 9. Dashboard — `/dashboard`

- Role badge ADMIN, workload metrics

#### 10. Ticket queue — `/tickets`

- All tickets, filters, pagination

#### 11. Ticket detail — `/tickets/:id`

- Reply to merchant, internal note, attachment
- Status, transfer team, assign agent

#### 12. My tickets — `/my-tickets`

- Tickets assigned to you

#### 13. Team queue — `/team-queue`

- Team tickets (admin can filter by team)

#### 14. Workload — `/workload`

- Agent active ticket counts

#### 15. Applications — `/applications`

- List, add, edit, delete (admin only)

#### 16. Modules — `/modules`

- Orders, Payments; add/edit modules

#### 17. Teams — `/teams`

- ApnaCart Support team and members

#### 18. Users — `/users`

- List, add, edit users (admin only)

### D. Team Lead — `lead@apnacart.support`

Visible: Dashboard, Ticket Queue, My Tickets, Team Queue, Workload.

Not visible: Applications, Modules, Teams, Users.

### E. Agent — `agent@apnacart.support`

Visible: Dashboard, Ticket Queue, My Tickets, Team Queue.

Not visible: Workload, admin pages, Assign To panel.

---

## Part 4 — End-to-end flow (30 min)

| Step | Who | Action |
|------|-----|--------|
| 1 | Merchant | OTP login → create ticket |
| 2 | Agent | Team Queue → IN_PROGRESS |
| 3 | Team Lead | Assign to agent |
| 4 | Agent | Reply to merchant |
| 5 | Merchant | See reply → reply back |
| 6 | Agent | Internal note (merchant must not see) |
| 7 | Agent | Upload attachment |
| 8 | Agent | Status → RESOLVED |
| 9 | Merchant | Confirm timeline and status |
| 10 | Admin | Verify in Ticket Queue |

---

## Part 5 — Backend-only (no UI yet)

- Classification: `POST /api/classification/classify`
- Omnichannel: `POST /api/omnichannel/inbound`
- Notification center: `GET /api/notification-center/summary`

---

## Part 6 — Production (optional)

- Vercel: `API_URL=https://support-system-qhjr.onrender.com/api`
- Render: real secrets, CORS for `support.elvatech.in`
- Register merchant email via **Merchants** admin page (no seed)

---

## Part 7 — Troubleshooting

| Problem | Fix |
|---------|-----|
| OTP not received | Add merchant under **Merchants** with correct email; check ELVA Notify config |
| Route not found | Backend not running or wrong API URL |
| Applications/modules empty | Data lives in the MongoDB in `MONGODB_URI` — if you changed URI (local ↔ Atlas), recreate setup in UI |
| CORS error | `CORS_ORIGIN=http://localhost:4200`; restart backend |

---

## Checklist

- [ ] npm install (backend + frontend)
- [ ] Backend :3000, frontend :4200 (admin auto-created on backend start)
- [ ] /health returns ok
- [ ] Landing + both login pages
- [ ] Merchant full flow
- [ ] Admin all views
- [ ] Team Lead + Agent roles
- [ ] End-to-end ticket lifecycle
