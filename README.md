# PayProof

Every sale verified by Monnify, not by screenshots. Full-stack: Next.js 16 (App Router,
JS) + Tailwind v4 + Prisma + Postgres + Monnify.

## Run it locally

```bash
npm install
cp .env.example .env.local          # then fill in the values (see below)
npm run db:migrate:deploy           # apply the schema to your Postgres
npm run db:seed                     # populate Ada, Tobi, and the AJ1 listing
npm run dev
```

Open http://localhost:3000. The demo accounts on the login page are wired to the seed —
"Continue as Ada" / "Continue as Tobi" sign in with real bearer tokens.

## Environment variables

All of `.env.example` is required. A few land-mines:

- **`DATABASE_URL` and `JWT_SECRET` are needed at BUILD time**, not just runtime, because
  the Prisma client is instantiated at module scope. `next build` will fail without them,
  even if the DB isn't reachable — set them (real or dummy) in your platform's build env.
- **`DATABASE_URL` vs `DIRECT_URL`**: on Supabase, `DATABASE_URL` should be the **pooled**
  (pgbouncer, port 6543) string for runtime; `DIRECT_URL` is the direct one, used only by
  Prisma migrations. Swapping them exhausts connections under load.
- **`MONNIFY_BASE_URL`**: keep `https://sandbox.monnify.com` for the demo. Real accounts
  require a BVN (the register form has an optional field for it); the sandbox uses a test
  BVN when none is provided.
- **`ALLOWED_ORIGINS`**: leave blank for local dev (allows all). In production set it to
  your exact domain(s), comma-separated.

## Demo flow (the judge walk)

1. `/` — landing: fake-screenshot vs stamped-seal argument.
2. `/login` → **Continue as Ada** → `/seller` (ledger, reserved account, orders).
3. `/seller/product` — edit the one listing; live buyer preview on the side.
4. Open a private window → `/p/aj1-low` → **Proceed to Secure Payment** → checkout.
5. `/pay/[orderId]` — the centerpiece: waits, then the PAID seal stamps itself when the
   Monnify webhook lands (poll every 3s; no refresh button). To trigger from the
   sandbox: send a `SUCCESSFUL_TRANSACTION` payload to `/api/monnify/webhook`.
6. `/orders/[id]` — six-state timeline, payment record, fraud flag if amount is unusual,
   inline assistant.
7. `/buyer` → **Confirm Delivery** on the shipped order → straight to Completed.
8. On the seller side, the completed order can be paid out via `POST /api/payouts/release/:id`
   (single-release enforced by the `Order.payoutClaimedAt` claim guard).

## Architecture

- **API surface**: `lib/api.js` — one function per backend route, real `fetch()` calls with
  bearer-token auth (stored in `localStorage`). `lib/store.jsx` mirrors it into React
  context and handles role-based hydration.
- **Backend**: `app/api/**` route handlers, Prisma models in `prisma/schema.prisma`.
- **The Seal**: `components/Seal.jsx` — used in exactly three places (account reveal,
  Paid moment, verified badge). Don't add a fourth.
- **Assistant answers**: `lib/assistant.js` — client-side, deterministic, rule-based.

Full route table, request/response shapes, exact state strings, and the honest list of
still-undecided things: **`API_CONTRACT.md`**.

## Deploy

The project targets **Railway** (persistent Node host, bundled Postgres). See
"Alternative: Vercel" below if you prefer serverless.

### Railway (recommended)

1. https://railway.app → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. In the same project, **+ New → Database → Add PostgreSQL**. Railway auto-injects
   `DATABASE_URL` into your service.
3. Service → **Variables** → add:
   - `DIRECT_URL` — same value as `DATABASE_URL` (Railway has no pooler, so both point
     to the same DB URL; the app uses `DATABASE_URL` at runtime and `DIRECT_URL` for
     `prisma migrate deploy`).
   - `JWT_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_CONTRACT_CODE` — from Monnify
     sandbox dashboard → Settings → API Keys.
   - `MONNIFY_WALLET_ACCOUNT_NUMBER` — from Monnify dashboard → Wallet.
   - `MONNIFY_BASE_URL=https://sandbox.monnify.com`
   - `ALLOWED_ORIGINS` — leave blank for the first deploy; set to your Railway domain
     once you know it, then redeploy.
   - `LOG_LEVEL=info`
   - **Skip `UPSTASH_*` vars.** Railway runs a persistent Node process, so the in-memory
     rate limiter is fine — the code falls back to it when Upstash vars are absent.
4. **Deploy Settings**:
   - **Build command**: `npm run build`
   - **Start command**: `npm run db:migrate:deploy && npm run db:seed && npm start`
     (the seed is idempotent; safe to run every deploy, and it populates the demo
     accounts the login page's quick-links need).
5. Push and let it build. First build ~2 min.
6. Copy your Railway domain (e.g. `payproof-production.up.railway.app`). Set
   `ALLOWED_ORIGINS` to `https://<that>` and redeploy.
7. Monnify dashboard → Settings → Webhooks → set to `https://<your-domain>/api/monnify/webhook`.
8. Smoke test: `https://<your-domain>/api/health` should return `{"status":"ok","db":"connected"}`.

### Alternative: Vercel

Works identically but requires two extra services because Vercel is serverless:

- External Postgres (Supabase or Neon). On Supabase, `DATABASE_URL` = pooled URI (port
  6543), `DIRECT_URL` = direct URI (port 5432). **Swapping them exhausts connections.**
- External Redis for rate limiting — set `UPSTASH_REDIS_REST_URL` and `_TOKEN` from
  https://console.upstash.com. Without them, the in-memory limiter resets on every
  cold start and attackers can evade limits.

Everything else is the same: env vars → migrate → seed → build.

### The Monnify webhook

Set to `https://<your-host>/api/monnify/webhook`. The route verifies HMAC-SHA512 (from
`MONNIFY_SECRET_KEY`) and cross-checks the transaction against Monnify's API before
advancing an order.
