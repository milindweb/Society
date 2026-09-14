# Cloudflare Pages — Setup Guide (Ready-to-Use)

This guide deploys the **frontend** to Cloudflare Pages and wires it to the Google Apps Script (GAS) backend.
All credentials/URLs are kept in `.env.original` (git-ignored); this guide only references them by name.

---

## 1. Credentials (from `.env.original`)

Open `.env.original` and read these values — they are the single source of truth:

| Variable | `.env.original` entry | Used for |
|---|---|---|
| `GAS_WEB_APP_URL` | `Web app URL` | `VITE_API_BASE_URL` build-time env var |
| `SCRIPT_ID` | `Script ID` | backend deploy (clasp) |
| `CLOUDFLARE_ACCOUNT` | your Cloudflare login | Pages project owner |

Do **not** commit `.env.original`. It is already listed in `.gitignore`.

---

## 2. Project Facts (already provisioned)

| Item | Value |
|---|---|
| Cloudflare account | `Itsmakk` (`kmi9@pm.me`) |
| Account ID | `cf3a286b2dbbeefcfc38dd44a3f325e3` |
| Pages project | `mysociety` |
| Production branch | `main` |
| Domains | `mysociety.pages.dev`, `soc.mk9.in` |
| Build command | `npm ci && npm run build` |
| Root directory | `frontend` |
| Output directory | `dist` |
| Env vars | `VITE_API_BASE_URL`, `VITE_APP_VERSION` |

The project is already connected to GitHub (`milindweb/Society`) with automatic production
deployments on every push to `main`.

---

## 3. One-Time Setup (already applied via API)

```text
build_command   = npm ci && npm run build
root_dir        = frontend
destination_dir = dist
env (prod+preview):
  VITE_API_BASE_URL = <Web app URL from .env.original>
  VITE_APP_VERSION  = 1.0.0
```

If re-creating from scratch, use the dashboard:

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select `milindweb/Society`.
3. Configure:
   - Build command: `npm ci && npm run build`
   - Build output directory: `dist`
   - Root directory (advanced): `frontend`
4. Add environment variables (`Settings → Environment variables`), for **Production** and **Preview**:
   - `VITE_API_BASE_URL` = Web app URL from `.env.original`
   - `VITE_APP_VERSION` = `1.0.0`
5. Save, then **Deploy**.

---

## 4. Deploy

### Automatic (recommended)
```bash
git push origin main
```
Cloudflare rebuilds `frontend/` and deploys to `https://mysociety.pages.dev` (and `soc.mk9.in`).

### Manual (via wrangler, if Git connection is ever removed)
```bash
cd frontend
npm ci
VITE_API_BASE_URL="<Web app URL from .env.original>" npm run build
npx wrangler pages deploy dist --project-name mysociety
```

---

## 5. Rollback

Cloudflare Pages keeps every deployment. To roll back:
1. Dashboard → Workers & Pages → `mysociety` → Deployments.
2. Find the good deployment → **⋮** → **Rollback to this deployment**.

The footer shows `VITE_APP_VERSION` so the live build is identifiable.

---

## 6. Verify

```bash
# Frontend serves (200)
curl -s -o /dev/null -w "%{http_code}\n" https://mysociety.pages.dev

# GAS backend responds
curl -s "<Web app URL from .env.original>?action=auth.health"
```

Expected: `200` from Pages, and `{"ok":true,...,"status":"healthy"}` from GAS.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Pages returns `404` on every route | missing `_redirects` | ensure `frontend/public/_redirects` contains `/* /index.html 200` |
| Build fails "VITE_API_BASE_URL missing" | env var not set | add it under Settings → Environment variables (Production + Preview) |
| API calls fail in browser | CSP blocks GAS origin | `_headers` already allows `script.google.com` + `script.googleusercontent.com`; don't remove them |
| Stale frontend | old Pages deployment | rollback or push a new commit |

Security headers (`_headers`) are part of the repo under `frontend/public/` — keep them; GAS cannot set them itself.
