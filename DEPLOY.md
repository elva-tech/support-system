# Deploying ELVA Support (Render + Vercel)

## How frontend talks to backend

Angular does **not** use a runtime `.env` file. API URL is set at **build time**:

| Environment | Config file | API URL |
|-------------|-------------|---------|
| Local dev (`ng serve`) | `frontend/src/environments/environment.ts` | `http://localhost:3000/api` |
| Production build | `frontend/src/environments/environment.prod.ts` | Set via `API_URL` env var on Vercel |

All HTTP services import `environment.apiUrl` (auth, tickets, merchant portal, etc.).

```
Browser (Vercel)  ──HTTPS──►  Render API (https://xxx.onrender.com/api/...)
```

## 1. MongoDB Atlas

Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas). Copy the connection string (use standard `mongodb://` URI if `mongodb+srv` fails on your host).

## 2. Backend on Render

1. Push this repo to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → select repo (`render.yaml` is included).
3. Or manually: **New Web Service** → connect repo → **Root Directory:** `backend` → **Build:** `npm install` → **Start:** `npm start`.
4. Set environment variables:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Long random string |
| `INTERNAL_API_KEY` | Long random string |
| `CORS_ORIGIN` | `https://YOUR-APP.vercel.app` |
| `CORS_ALLOW_VERCEL_PREVIEWS` | `true` (optional, for Vercel preview URLs) |
| `API_BASE_URL` | `https://YOUR-API.onrender.com` |
| `LOG_OTP_TO_CONSOLE` | `false` |
| `EXPOSE_OTP_IN_RESPONSE` | `false` |
| `ELVA_NOTIFY_APP_ID` | Your Notify app ID |
| `ELVA_NOTIFY_API_KEY` | Your Notify API key |
| `ELVA_NOTIFY_BRAND_ID` | Your brand ID |

5. After deploy, verify: `https://YOUR-API.onrender.com/health`
6. Seed data (Render Shell): `npm run seed`

**Note:** Render free tier has ephemeral disk — uploaded attachments are lost on redeploy unless you configure Google Drive (`GOOGLE_DRIVE_MOCK=false`) or a Render persistent disk.

## 3. Frontend on Vercel

1. [Vercel Dashboard](https://vercel.com) → **Add New Project** → import repo.
2. **Root Directory:** `frontend`
3. **Framework Preset:** Other (or Angular if listed)
4. **Build Command:** `npm run build` (default from `vercel.json`)
5. **Output Directory:** `dist/frontend/browser`
6. **Environment variable** (Production):

| Name | Value |
|------|-------|
| `API_URL` | `https://YOUR-API.onrender.com/api` |

7. Deploy. Open your Vercel URL — login and merchant OTP should hit the Render API.

## 4. Update CORS after first Vercel deploy

Copy your live Vercel URL into Render `CORS_ORIGIN`. Redeploy the API if needed.

## Alternative: Docker (single host)

`docker-compose up` serves frontend on port 8080 with nginx proxying `/api` to the backend. No `API_URL` needed — prod build uses relative `/api`.

## Local production build test

```bash
cd frontend
set API_URL=https://your-api.onrender.com/api   # Windows
npm run build
npx serve dist/frontend/browser -l 4200 -s
```
