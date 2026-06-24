# ELVA Support System — Phase 1 & 2

Multi-tenant support platform with JWT admin portal and OTP-based merchant portal.

## Stack

- **Backend:** Node.js, Express, MongoDB, Mongoose, JWT
- **Frontend:** Angular 20, Tailwind CSS

## Prerequisites

- Node.js 20.19+ (recommended for Angular CLI)
- MongoDB running locally or a connection string

## Quick Start

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your MongoDB URI and JWT secret.

### 3. Seed data

```bash
npm run backend:seed
```

Seeds admin user, applications (APN, NAN, NTF, LNK), and ApnaCart demo merchant.

### 4. Run backend

```bash
npm run backend
```

API: `http://localhost:3000`

### 5. Run frontend

```bash
npm run frontend
```

App: `http://localhost:4200`

## API Endpoints

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| POST | `/api/auth/login` | Public | — |
| GET | `/api/auth/me` | JWT | All |
| CRUD | `/api/applications` | JWT | Read: all, Write: ADMIN |
| CRUD | `/api/modules` | JWT | Read: all, Write: ADMIN |
| CRUD | `/api/teams` | JWT | Read: all, Write: ADMIN |
| CRUD | `/api/users` | JWT | Read: all, Write: ADMIN |

### Merchant APIs (session token via `X-Merchant-Session` header)

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/merchant/request-otp` | Public |
| POST | `/api/merchant/verify-otp` | Public |
| GET | `/api/merchant/me` | Merchant Session |
| POST | `/api/merchant/logout` | Merchant Session |

### Internal Integration API

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/internal/merchants/sync` | `X-Internal-Api-Key` header |

## Roles

- `ADMIN` — Full CRUD access
- `TEAM_LEAD` — Read access, team management (Phase 2)
- `AGENT` — Read access

## Project Structure

```
backend/src/
  modules/     auth, applications, modules, teams, users, merchants
  shared/      middleware, utils, constants
  config/      database, env
  scripts/     seed

frontend/src/app/
  core/              admin guards, interceptors, services
  features/          admin portal screens
  merchant-portal/   isolated merchant OTP auth flow
  layout/            shell
  shared/            reusable components
```

## Phase 2 — Merchant Identity Layer

- Passwordless merchant onboarding via OTP
- Session-token auth (separate from admin JWT)
- Internal merchant sync API for application integrations
- Merchant portal at `/merchant/login`

**Test merchant:** `merchant@apnacart.demo` (after seed). OTP is logged to the backend console in development.

## Phase 1 Scope

- Admin login with JWT
- Applications, Modules, Teams, Users CRUD
- Route guards and role-based access
- Request validation (express-validator)

**Not included:** Conversations, attachments, replies, email integration, queue/assignment management, notifications

## Phase 3 — Ticket Core

- `ticket_sequences` for atomic ticket numbers (`APN-2026-000001`)
- Merchant ticket create/list/view with auto team routing via `module.defaultTeamId`
- Agent portal read-only ticket list and details
- Merchant dashboard: Open / Resolved / Closed counts

**Test flow:** Seed → merchant login → Create Ticket (ORDERS module) → view in agent `/tickets`

## Phase 4 — Communication Layer

- Ticket conversations (messages, internal notes, system events)
- Shared timeline with attachments
- Google Drive service abstraction (mock mode for dev, real API when configured)
- Agent: reply, internal notes, status change, team transfer
- Merchant: reply, timeline, attachment upload

**Google Drive:** Set `GOOGLE_DRIVE_MOCK=false` and configure `GOOGLE_SERVICE_ACCOUNT_JSON` + `GOOGLE_DRIVE_PARENT_FOLDER_ID` for production.

## Phase 5 — Support Operations Layer

Queue management, assignment workflows, and operational dashboards for support teams.

### Schema

`tickets` collection adds `assignedTo` (ref User) and `assignedAt` (Date).

### Operations APIs

| Method | Endpoint | Auth | Role |
|--------|----------|------|------|
| PATCH | `/api/tickets/:id/assign` | JWT | ADMIN, TEAM_LEAD |
| GET | `/api/tickets/my` | JWT | All agents |
| GET | `/api/tickets/team` | JWT | All agents |
| GET | `/api/tickets` | JWT | All (filters: application, module, team, status, assignedTo) |
| GET | `/api/dashboard/agent` | JWT | All agents |
| GET | `/api/dashboard/team-workload` | JWT | ADMIN, TEAM_LEAD |

### Agent Portal Pages

- **Dashboard** — Assigned to me, open tickets, waiting for customer, resolved today
- **Ticket Queue** — Full queue with filters
- **My Tickets** — Tickets assigned to the current agent
- **Team Queue** — Team-scoped queue (read-only for agents)
- **Workload** — Per-agent ticket counts (ADMIN / TEAM_LEAD)
- **Ticket Detail** — Assign To dropdown (ADMIN / TEAM_LEAD only)

### Permissions

| Role | Access |
|------|--------|
| ADMIN | Full access including admin CRUD and workload |
| TEAM_LEAD | Team queue, assignment, workload (scoped to team) |
| AGENT | My tickets, team queue (read-only) |

### Seed Users (ApnaCart Support team)

| Role | Email | Password |
|------|-------|----------|
| Team Lead | `lead@apnacart.support` | `Lead@12345` |
| Agent | `agent@apnacart.support` | `Agent@12345` |
| Agent | `agent2@apnacart.support` | `Agent@12345` |

**Test flow:** Seed → login as team lead → open team queue → assign ticket to agent → login as agent → verify My Tickets and dashboard metrics.

## Phase 6 — Production Readiness

Auditing, security hardening, observability, pagination, search, and deployment readiness.

### New Collections

- `audit_logs` — automatic audit trail for all major actions
- `notification_events` — foundation for future notifications (no email sending yet)

### Audit Events

`MERCHANT_LOGIN`, `AGENT_LOGIN`, `TICKET_CREATED`, `TICKET_ASSIGNED`, `TICKET_TRANSFERRED`, `STATUS_CHANGED`, `REPLY_ADDED`, `INTERNAL_NOTE_ADDED`, `ATTACHMENT_UPLOADED`

### APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | `{ status, mongodb, storage, version }` |
| GET | `/api/tickets` | Paginated + searchable (`page`, `limit`, `search`) |
| GET | `/api/tickets/my` | Paginated + searchable |
| GET | `/api/tickets/team` | Paginated + searchable |
| GET | `/api/dashboard/agent` | Adds `ticketsCreatedToday`, `ticketsResolvedToday`, `averageResolutionTime` |

### Security

- Rate limiting on login and OTP endpoints
- Upload file type validation and configurable size limits
- Environment validation on startup (strict in production)

### Production Deployment

Set `NODE_ENV=production` and configure all required env vars (`MONGODB_URI`, `JWT_SECRET`, `INTERNAL_API_KEY`, `CORS_ORIGIN`). Verify health: `GET /health`.

**Render + Vercel:** See [DEPLOY.md](DEPLOY.md) for step-by-step production deployment. Frontend API URL is injected at build time via the `API_URL` environment variable on Vercel (see `frontend/.env.example`).

## Phase 6.5 — ELVA Notify Integration

Delegates notification **delivery** to ELVA Notify with log-based fallback. OTP generation, storage, and verification remain in ELVA Support.

### Architecture

`NotificationManager` → `ElvaNotifyProvider` → `FallbackProvider` (on failure)

### Components

- **NotificationWorker** — polls `notification_events`, delivers, marks `processed`
- **notification_deliveries** — tracks provider, status, errors per attempt
- **OTP** — `NotificationManager.sendOtp()` replaces console OTP logging

### Worker event types

`TICKET_CREATED`, `AGENT_REPLY`, `STATUS_CHANGED`, `TICKET_RESOLVED`

### Configuration

```env
NOTIFICATION_PROVIDER=ELVA_NOTIFY
NOTIFICATION_FALLBACK_ENABLED=true
ELVA_NOTIFY_API_URL=https://notify.elva.example/api
ELVA_NOTIFY_API_KEY=your-key
```

See [backend/docs/NOTIFICATIONS.md](backend/docs/NOTIFICATIONS.md) for API contract and full configuration.
