# Free demo deployment

Three pieces, three free services:

| Piece | Service | Config file |
|---|---|---|
| `apps/api` + Postgres | [Render](https://render.com) free tier | [`render.yaml`](render.yaml) |
| `apps/web` | [Vercel](https://vercel.com) free tier | [`vercel.json`](vercel.json) |
| `apps/mobile` | Expo Go + EAS Update (free) | [`apps/mobile/eas.json`](apps/mobile/eas.json) |

All three read config from environment variables already, so no code changes are needed — just account setup and env vars. Push this branch (including the three files above) to GitHub before starting; both Render and Vercel deploy from a GitHub repo.

---

## 1. API + Postgres on Render

1. Sign up at render.com (free, no card required for the free tier) and connect your GitHub account.
2. **New → Blueprint**, pick this repo. Render reads [`render.yaml`](render.yaml) and proposes a free Postgres database (`tahkeem-db`) and a free web service (`tahkeem-api`). Click **Apply**.
3. First deploy takes a few minutes (installs, builds `packages/shared`, builds the API, runs `prisma migrate deploy`). Watch the logs for `API on http://localhost:.../api`.
4. Seed the database **once**, from the Render dashboard → `tahkeem-api` → **Shell**:
   ```bash
   pnpm --filter @tahkeem/api prisma:seed
   ```
   (The seed script is re-runnable, but don't put it in the start command — it would rerun on every restart/wake.)
5. Note the service URL Render gives you, e.g. `https://tahkeem-api.onrender.com`. The API lives at `https://tahkeem-api.onrender.com/api`, docs at `/api/docs`.
6. Grab the generated `SEED_ADMIN_PASSWORD` from the service's **Environment** tab — that's the demo admin login (email `admin@omar-quran.tn`).

**Free-tier caveats to set expectations with your client:**
- The web service spins down after 15 minutes idle; the first request after that takes ~30–60s to wake up. Warn the client, or open the dashboard yourself a minute before the call.
- The free Postgres database expires after 30 days — fine for a demo, but don't leave a client relying on it long-term without upgrading.

---

## 2. Web dashboard on Vercel

1. Sign up at vercel.com, connect GitHub, **Add New → Project**, pick this repo.
2. Vercel auto-detects the pnpm workspace and reads [`vercel.json`](vercel.json) for the build command (`pnpm shared:build && pnpm --filter @tahkeem/web build`) and output dir (`apps/web/dist`). Leave "Root Directory" as the repo root.
3. Before the first deploy, add an environment variable:
   - `VITE_API_URL` = `https://tahkeem-api.onrender.com/api` (the Render URL from step 1, with `/api`).
4. Deploy. Vercel gives you a URL like `https://tahkeem-web.vercel.app`.
5. Back on Render, update the API's `CORS_ORIGINS` env var to include that Vercel URL (comma-separated, no trailing slash), e.g.:
   ```
   CORS_ORIGINS=https://tahkeem-web.vercel.app
   ```
   Save — Render redeploys automatically. Without this the dashboard's requests will be blocked by CORS.

---

## 3. Mobile app via Expo Go

The judge's app can be shared as a link the client opens in the **Expo Go** app — no App/Play Store submission, no APK build.

1. `npm install -g eas-cli` (once), then from `apps/mobile`: `eas login` (free Expo account).
2. `eas init` — links this project to your Expo account and writes a project ID into `app.json`.
3. `eas update:configure` — wires up `expo-updates` (adds a `runtimeVersion`/`updates` block to `app.json`).
4. Point the published build at the live API — add to `apps/mobile/.env` (create it) or export before publishing:
   ```
   EXPO_PUBLIC_API_URL=https://tahkeem-api.onrender.com/api
   ```
   This overrides the "read the Metro dev-server host" logic in `src/lib/api.ts`, which only makes sense for local dev.
5. Publish: `eas update --branch demo --message "client demo"`.
6. The command prints a link (`https://expo.dev/accounts/<you>/projects/tahkeem/updates/...`) and a QR code. Your client:
   - Installs **Expo Go** from the Play Store / App Store.
   - Scans the QR code (or opens the link on the phone) — Expo Go downloads and runs the app.

Re-publish (`eas update --branch demo ...`) any time you change mobile code; the client re-opens the same link and gets the new version, no reinstall.

**Caveat:** Expo Go can only run apps built entirely from packages it ships with — no custom native modules outside the Expo SDK. This app only uses standard Expo packages (camera, secure-store, gesture-handler, reanimated, bottom-sheet), so it should work, but if Expo Go rejects it with a native-module mismatch, the fallback is `eas build --profile preview --platform android` (already scaffolded in `eas.json`) to produce an installable `.apk` instead — still free, just slower (EAS's free build queue).

---

## Order of operations

Deploy API first (you need its URL for both web and mobile), then web (you need its URL to lock down CORS), then mobile.
