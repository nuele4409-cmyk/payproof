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

## Deploy notes

- **Run migrations on deploy**: `npm run db:migrate:deploy` (uses `prisma migrate deploy`,
  non-interactive, safe for CI).
- **Rate limiting** (`lib/rateLimit.js`) is an in-memory `Map` — fine on a single
  persistent Node host, but resets per-instance on serverless (Vercel, Cloudflare Workers).
  On serverless, swap to Upstash/Redis or your platform's KV before going live.
- **Webhook URL**: point Monnify's dashboard at `https://<your-host>/api/monnify/webhook`.
  The route verifies HMAC-SHA512 (from `MONNIFY_SECRET_KEY`) and cross-checks the
  transaction against Monnify's API before advancing an order.
- **First deploy** flow: set env vars → run migrations → seed (optional, demo only) → build.
