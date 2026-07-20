# PayProof

Every sale verified by Monnify, not by screenshots. Full-stack: Next.js 16 (App Router,
JS) + Tailwind v4 + Prisma + Postgres + Monnify.

## Run it locally

```bash
npm install
cp .env.example .env.local          # then fill in the values (see below)
npm run db:migrate:deploy           # apply the schema to your Postgres
npm run dev
```

Open http://localhost:3000. There's no seed script — the first seller you register
becomes the pilot seller.

## Environment variables

All of `.env.example` is required. A few land-mines:

- **`DATABASE_URL` and `JWT_SECRET` are needed at BUILD time**, not just runtime, because
  the Prisma client is instantiated at module scope. `next build` will fail without them,
  even if the DB isn't reachable — set them (real or dummy) in your platform's build env.
- **`DATABASE_URL` vs `DIRECT_URL`**: on Supabase, `DATABASE_URL` should be the **pooled**
  (pgbouncer, port 6543) string for runtime; `DIRECT_URL` is the direct one, used only by
  Prisma migrations. Swapping them exhausts connections under load. On Railway Postgres
  there's no pooler, so both point to the same URL: set `DIRECT_URL=${{Postgres.DATABASE_URL}}`.
- **`MONNIFY_BASE_URL`**: `https://api.monnify.com` for production, `https://sandbox.monnify.com`
  for testing. BVN is required at seller registration for both — the sandbox no longer
  auto-fills a test BVN.
- **`ALLOWED_ORIGINS`**: leave blank for local dev (allows all). In production set it to
  your exact domain(s), comma-separated.

## Live flow

1. Seller signs up at `/register` → picks **Sell** → provides real BVN → Monnify opens a
   real reserved account; failure rolls back the signup so the seller can retry.
2. Seller lands on `/seller/welcome` with the reserved account stamped, then `/seller` for
   the ledger. Sets a settlement (payout) bank account in the settlement form.
3. Seller edits their listing at `/seller/product`; buyers see it at `/p/aj1-low`.
4. Buyer signs up at `/register` → picks **Buy** (no BVN needed for buyers), or logs in
   from `/login`.
5. Buyer clicks **Proceed to Secure Payment** → checkout requires auth, so unsigned
   visitors are bounced to `/login?redirect=/p/…/checkout` and returned after login.
6. `/pay/[orderId]` waits for the Monnify webhook (`/api/monnify/webhook`), polling
   `GET /api/orders/:id` every 3s. The PAID seal stamps itself when payment lands.
7. Seller marks as shipped from `/seller`; buyer confirms delivery from `/orders/[id]`.
8. Seller releases payout from `/seller` — hits `POST /api/payouts/release/:id`, which
   uses `Order.payoutClaimedAt` as an atomic single-release guard.

**Multi-seller note (open):** the storefront URL is hardcoded to `/p/aj1-low` across
navigation. Whichever seller registers first and saves a product owns that slug; other
sellers can't save (ownership check on `PUT /api/products/:id`). This is a fixed "pilot
seller" MVP shape. Onboarding multiple sellers needs per-seller slugs + updated nav —
tracked as work not yet done.

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
   - **Start command**: `npm run db:migrate:deploy && npm start`
     (migrate:deploy is idempotent; safe to run every deploy).
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
