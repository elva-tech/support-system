# Deploying ELVA Support (Render + Vercel)

Production targets:

| Service | URL |
|---------|-----|
| Frontend | `https://support.elvatech.in` (Vercel) |
| Backend API | `https://support-system-qhjr.onrender.com` |

## How frontend talks to backend

Angular does **not** use a runtime `.env` file. API URL is set at **build time**:

| Environment | Config | API URL |
|-------------|--------|---------|
| Local dev (`ng serve`) | `frontend/src/environments/environment.ts` | `http://localhost:3000/api` |
| Production build | `API_URL` on Vercel → `write-environment.js` | `https://support-system-qhjr.onrender.com/api` |

```
Browser (Vercel)  ──HTTPS──►  Render API (/api/...)
```

## 1. MongoDB Atlas

1. Create a cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a **production** database (e.g. `elva-support-prod`) — do not use your local dev database.
3. Copy the connection string and add it to Render as `MONGODB_URI`.
4. Allow network access from anywhere (`0.0.0.0/0`) or Render's IP ranges.

## 2. Backend on Render

### Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → select repo (`render.yaml` is included).
3. Fill in **sync: false** secrets when prompted (MongoDB, SMTP, IMAP, admin password, CORS).

### Option B — Manual web service

- **Root Directory:** `backend`
- **Build:** `npm install`
- **Start:** `npm start`
- **Health check:** `/health`

### Required environment variables (Render)

Copy from `backend/.env.example`. Set these in Render Dashboard → Environment:

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas URI for **prod** database |
| `JWT_SECRET` | Long random string (Render can auto-generate) |
| `INTERNAL_API_KEY` | Long random string (Render can auto-generate) |
| `CORS_ORIGIN` | `https://support.elvatech.in` |
| `FRONTEND_URL` | `https://support.elvatech.in` |
| `API_BASE_URL` | `https://support-system-qhjr.onrender.com` |
| `ADMIN_EMAIL` | Your admin login email |
| `ADMIN_PASSWORD` | Strong password (admin user created on first start) |
| `NOTIFICATION_PROVIDER` | `SMTP` |
| `EMAIL_SUPPORT_ADDRESS` | `support@elvatech.in` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail account (e.g. `tech.elva@gmail.com`) |
| `SMTP_PASS` | Gmail App Password |
| `EMAIL_INBOUND_ENABLED` | `true` |
| `EMAIL_IMAP_HOST` | `imap.gmail.com` |
| `EMAIL_IMAP_USER` | Same Gmail account |
| `EMAIL_IMAP_PASSWORD` | Same App Password |
| `EMAIL_IMAP_MAILBOX` | `support@elvatech.in` |
| `LOG_OTP_TO_CONSOLE` | `false` |
| `EXPOSE_OTP_IN_RESPONSE` | `false` |
| `LOG_VIEWER_ENABLED` | `false` |

Generate secrets locally:

```bash
node -e "const c=require('crypto'); console.log('JWT_SECRET='+c.randomBytes(48).toString('hex')); console.log('INTERNAL_API_KEY='+c.randomBytes(32).toString('hex'));"
```

### After deploy

1. Verify: `https://support-system-qhjr.onrender.com/health`
2. Log in at the frontend with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
3. Create merchants and teams from the admin UI (no seed script — admin is bootstrapped automatically).

### Gmail / support@ setup

- SMTP login = Gmail account; **From** address = `support@elvatech.in` (configure "Send mail as" in Gmail).
- IMAP polls the `support@elvatech.in` label/mailbox on the shared inbox.
- Use a [Gmail App Password](https://myaccount.google.com/apppasswords), not your regular password.

### Render free tier notes

- Ephemeral disk — uploaded attachments are lost on redeploy unless you set `GOOGLE_DRIVE_MOCK=false` with Google Drive credentials.
- Free services spin down after inactivity; first request may be slow.

## 3. Frontend on Vercel

1. [Vercel Dashboard](https://vercel.com) → **Add New Project** → import repo.
2. **Root Directory:** `frontend`
3. **Build Command:** `npm run build` (from `vercel.json`)
4. **Output Directory:** `dist/frontend/browser`
5. **Environment variable** (Production):

| Name | Value |
|------|-------|
| `API_URL` | `https://support-system-qhjr.onrender.com/api` |

6. Add custom domain `support.elvatech.in` in Vercel → Domains.
7. Deploy.

## 4. Final CORS check

Ensure Render `CORS_ORIGIN` includes your live frontend URL (`https://support.elvatech.in`). Redeploy the API if you change it.

Optional: set `CORS_ALLOW_VERCEL_PREVIEWS=true` for Vercel preview deployments.

## Alternative: Docker (single host)

`docker-compose up` serves frontend on port 8080 with nginx proxying `/api` to the backend. No `API_URL` needed — prod build uses relative `/api`.

## Local production build test

```bash
cd frontend
set API_URL=https://support-system-qhjr.onrender.com/api   # Windows
npm run build
npx serve dist/frontend/browser -l 4200 -s
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `JWT_SECRET must not use the development default` | Set a new random `JWT_SECRET` on Render |
| `INTERNAL_API_KEY must not use the development default` | Set a new random `INTERNAL_API_KEY` on Render |
| `MONGODB_URI is required` | Add Atlas connection string |
| `CORS_ORIGIN is required` | Set `https://support.elvatech.in` |
| `SMTP email is not configured` | Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |
| OTP not arriving | Merchant must exist in prod DB; SMTP must be configured; check Render logs |
| OTP slow then no email | Set `NOTIFICATION_FALLBACK_ENABLED=false` on Render; verify `SMTP_PASS` is a Gmail App Password; search logs for `[FallbackProvider]` (means SMTP failed but UI still succeeded) |
| `ENETUNREACH` / IPv6 SMTP error on Render | Redeploy latest code (forces IPv4 for Gmail). Error looks like `connect ENETUNREACH 2607:f8b0:...:587` |
| `Route not found` at backend URL | Normal in production — `LOG_VIEWER_ENABLED=false`. Use Render Dashboard → Logs, or `/health` to verify the API |
| Login works locally but not on Vercel | Check `API_URL` ends with `/api` and CORS matches frontend domain |
