
# PayProof

Escrow for online sellers. Instead of trusting screenshots, PayProof uses Monnify to verify bank transfers in real time and holds funds until the buyer confirms delivery.

When a seller registers, Monnify opens a dedicated reserved account (a unique NUBAN per seller). The seller shares their storefront link on WhatsApp. The buyer visits the storefront, checks out without creating an account (name + phone only), and transfers into the reserved account. The pay page polls `GET /api/orders/[id]` every 3 seconds. When Monnify sends a webhook, PayProof verifies the transaction against Monnify's API, and the order advances through a six-state machine. The seller is only paid after the buyer confirms delivery — the money moves from the reserved account to the seller's personal settlement account via Monnify disbursement.

Built for WhatsApp merchants who currently rely on payment screenshots and trust. Checkout is guest-only — buyers don't need an account to browse or buy. Buyer accounts exist only for post-purchase order tracking.

## Tech stack

| Library | Version | Used for |
|---|---|---|
| Next.js | 16.2.10 (App Router) | Server routing, API routes, React server/client components |
| React | 19.2.4 | UI |
| Tailwind CSS | 4 | Styling |
| Prisma | 7.8 | ORM, PostgreSQL schema, migrations |
| bcrypt | 6 | Password hashing |
| jsonwebtoken | 9 | JWT signing and verification |
| @upstash/ratelimit + @upstash/redis | 2 / 1 | Rate limiting on serverless (falls back to in-memory) |
| @neondatabase/serverless + @prisma/adapter-neon | 1 / 7 | Database adapter for serverless deployment |

**Installed but unused in the current codebase:** `axios`, `cors`, `express`, `dotenv`, `ws` — these are not imported or called anywhere. All HTTP requests use the built-in `fetch` API.

**Dev-only:** `typescript` (6), `eslint`, `tailwindcss`, `@tailwindcss/postcss`, `ts-node-dev`, `@types/*`.

## Architecture

```
Buyer                 PayProof                          Monnify
 │                      │                                  │
 │  visits storefront   │                                  │
 │─────────────────────►│                                  │
 │                      │                                  │
 │  creates order       │                                  │
 │  ("Pending Payment") │                                  │
 │─────────────────────►│                                  │
 │                      │                                  │
 │  transfers ₦X to     │                                  │
 │  seller's reserved   │                                  │
 │  account             │                                  │
 │────────────────────────────────────────────────────────►│
 │                      │                                  │
 │                      │   webhook (SUCCESSFUL_TRANSACTION)│
 │                      │◄─────────────────────────────────│
 │                      │                                  │
 │                      │   verify via Monnify API         │
 │                      │─────────────────────────────────►│
 │                      │   verified ✓                     │
 │                      │◄─────────────────────────────────│
 │                      │                                  │
 │                      ├── order → "Paid"                 │
 │                      ├── order → "Awaiting Shipment"    │
 │                      │   fraud check runs here          │
 │                      │                                  │
Seller                                                      │
 │  marks shipped        │                                  │
 │─────────────────────►│                                  │
 │                      ├── order → "Shipped"              │
 │                      │                                  │
Buyer                                                       │
 │  confirms delivery    │                                  │
 │─────────────────────►│                                  │
 │                      ├── order → "Delivered"            │
 │                      ├── order → "Completed"            │
 │                      │                                  │
Seller                                                      │
 │  releases payout      │                                  │
 │─────────────────────►│   singleTransfer → seller's       │
 │                      │   settlement account             │
 │                      │─────────────────────────────────►│
```
<img width="862" height="478" alt="Screenshot 2026-07-22 at 06 17 19" src="https://github.com/user-attachments/assets/9f40677c-6361-4dc6-9f68-a79c3a102b20" />

### Frontend pages

| Path | Component | Purpose |
|---|---|---|
| `/` | Landing | Marketing page with FAQ + CTA |
| `/login` | Login form | Email/password sign-in |
| `/register` | Registration form | Email/password + role toggle (buyer/seller); seller requires BVN |
| `/buyer` | Buyer dashboard | Lists orders where `buyer` name matches current user |
| `/seller` | Seller dashboard | Order ledger, share product link button, settlement account form, storefront link, assistant panel |
| `/seller/product` | Listing editor | Create/edit the seller's single product |
| `/seller/welcome` | Onboarding | Post-registration screen showing reserved account |
| `/p/[id]` | Storefront | Public product page shared with buyers |
| `/p/[id]/checkout` | Checkout | Guest-only name + phone form, creates order without login |
| `/pay/[orderId]` | Payment screen | Shows reserved account, Monnify seal, polls every 3s, manual refresh button, sandbox simulate link |
| `/orders/[id]` | Order detail | Timeline, assistant Q&A, ship/confirm actions |

## Setup

**Prerequisites:** Node.js 20+, PostgreSQL (Supabase recommended).

```bash
git clone https://github.com/nuele4409-cmyk/payproof.git
cd payproof
cp .env.example .env.local
```

Fill in `.env.local` (see [Environment variables](#environment-variables) below).

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The dev server starts at `http://localhost:3000`.

For production:

```bash
npm run build
npm start
```

Requires a Monnify sandbox or production account, a Supabase (PostgreSQL) instance, and optionally Upstash Redis for serverless rate limiting.

## API

All requests and responses use JSON. Auth endpoints are unauthenticated; seller/buyer endpoints require `Authorization: Bearer <token>`. When `MONNIFY_BASE_URL` contains `sandbox`, several endpoints (settlement save, payout release, bank validation) skip real Monnify API calls and return simulated responses.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create account (buyer or seller). Seller requires BVN for Monnify reserved account. |
| `POST` | `/api/auth/login` | No | Sign in, returns JWT. |
| `GET` | `/api/health` | No | Health check — returns DB connection status + latency. |
| `POST` | `/api/monnify/webhook` | No (HMAC) | Monnify payment notification. Verifies via Monnify API, advances order to Paid → Awaiting Shipment. |
| `POST` | `/api/monnify/simulate` | No | Sandbox-only. Simulates a Monnify payment for testing — advances a pending order to Paid → Awaiting Shipment. `POST { orderId }` or `{ sellerId, amount }`. Returns 403 outside sandbox. |
| `GET` | `/api/orders` | Yes | List seller's orders (descending by creation date). |
| `POST` | `/api/orders` | No | Create order at "Pending Payment". Body: `{ buyerName, productSlug, phone }`. Guest-accessible. |
| `GET` | `/api/orders/[id]` | No | Single order with seller details (account, settlement). |
| `POST` | `/api/orders/[id]/ship` | Seller | Mark order Shipped. Validates seller owns the order. |
| `POST` | `/api/orders/[id]/confirm-delivery` | Yes (not seller) | Mark Delivered → Completed. Sellers cannot confirm their own orders. |
| `POST` | `/api/payouts/release/[id]` | Seller | Disburse completed order funds to seller's settlement account. Atomic claim prevents double-payout. In sandbox mode, skips the real Monnify transfer. |
| `POST` | `/api/payouts/validate-bank` | Seller | Validate settlement bank account via Monnify. In sandbox mode, validation is skipped. |
| `GET` | `/api/products/[id]` | No | Public product (by slug or numeric ID). Returns seller name/store/verified status. |
| `GET` | `/api/seller/me` | Seller | Seller profile: store name, reserved account, masked settlement account, storefront link. |
| `PUT` | `/api/seller/me/product` | Seller | Create or update the seller's single product listing. |
| `POST` | `/api/seller/me/settlement` | Seller | Save settlement bank account. In sandbox mode, Monnify validation is bypassed. |

### Response shape

Success: `{ ...data }` with status 200/201.

Error: `{ error: "<message>", code: "<ERROR_CODE>" }` with the appropriate HTTP status.

Auth errors return `{ error: "Authentication required.", code: "AUTH_REQUIRED" }` (401).

Rate limits return `{ error: "Too many requests. Please try again later.", code: "RATE_LIMITED" }` (429).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase via PgBouncer). |
| `DIRECT_URL` | Yes | Direct PostgreSQL connection string (bypasses PgBouncer for migrations). |
| `JWT_SECRET` | Yes | Secret for signing JWTs. Minimum 32 characters. |
| `MONNIFY_API_KEY` | Yes | Monnify API key (starts with `MK_TEST_` or `MK_PROD_`). |
| `MONNIFY_SECRET_KEY` | Yes | Monnify secret key. |
| `MONNIFY_CONTRACT_CODE` | Yes | Monnify contract code from dashboard. |
| `MONNIFY_BASE_URL` | Yes | `https://sandbox.monnify.com` or `https://api.monnify.com`. |
| `MONNIFY_WALLET_ACCOUNT_NUMBER` | Yes | Your Monnify wallet account number (source for disbursements). |
| `UPSTASH_REDIS_REST_URL` | No | Redis REST URL for rate limiting on serverless. Leave blank for in-memory fallback. |
| `UPSTASH_REDIS_REST_TOKEN` | No | Redis REST token. Leave blank for in-memory fallback. |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins. Empty allows all (local dev only). |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error`. Defaults to `debug` in dev, `info` in production. |

## Order state machine

Six states. Each transitions only to the next.

```
Pending Payment  ──►  Paid  ──►  Awaiting Shipment  ──►  Shipped  ──►  Delivered  ──►  Completed
```

| State | Meaning | Set by |
|---|---|---|
| `Pending Payment` | Order created, awaiting buyer's transfer | `POST /api/orders` |
| `Paid` | Monnify confirmed payment received | Monnify webhook (`POST /api/monnify/webhook`) |
| `Awaiting Shipment` | Payment verified, seller notified | Same webhook (after Paid) |
| `Shipped` | Seller marked order as shipped | `POST /api/orders/[id]/ship` (seller only) |
| `Delivered` | Buyer confirmed delivery | `POST /api/orders/[id]/confirm-delivery` |
| `Completed` | Settlement triggered | Same confirm-delivery endpoint |

The `timestamps` map on each order stores an ISO-8601 string for every state the order has reached, keyed by the state string (e.g. `"Paid": "2026-07-21T10:00:00.000Z"`).

**Fraud check:** When the webhook processes a payment, `runFraudCheck` compares the amount to `seller.typicalOrder`. If the ratio exceeds 5×, the order is marked `flagged: true` with a human-readable reason. The flag is surfaced in the assistant answers and the order detail view.

## Live deployment

`https://payproof.up.railway.app`

## Known limitations

1. **Single-product MVP.** Each seller can only list one product. The product page URL uses a slug derived from the seller's user ID. Multiple listings per seller would require a schema and routing change.

2. **Buyer identity is a display-name string.** Orders store `buyer` as the name the buyer typed at checkout. The buyer dashboard filters by name matching — not a user ID. There is no buyer user object linked to orders.

3. **Fraud rule threshold is hardcoded.** The 5× multiplier in `runFraudCheck` (`lib/orderService.js:131`) has no configuration surface.

4. **Integer naira vs Monnify decimals.** The frontend and API use integer naira (₦50,000). Monnify's API uses decimal amounts (50000.00). Conversion is implicit at the Monnify boundary — no dedicated conversion layer.

5. **Image upload via base64.** Seller product images are read as data URLs via `FileReader.readAsDataURL` and stored directly in the database. No file upload endpoint, no CDN, no size limit enforcement (large images silently fail to persist).

6. **Order-page privacy.** Order IDs are capability URLs — anyone with the URL can view an order. There is no auth gate on `GET /api/orders/[id]` or the corresponding frontend pages.

7. **Delivered→Completed transition.** Both transitions happen atomically in a single `confirm-delivery` call. Settlement timing (instant vs after Monnify callback) was not finalized.

8. **Assistant is client-side.** The order-scoped Q&A (`lib/assistant.js`) runs entirely client-side using deterministic keyword matching. It requires no backend but cannot reference data not already in the order object.

9. **Sandbox Monnify validation.** Monnify's sandbox environment doesn't validate bank accounts or process real transfers. PayProof detects sandbox mode and bypasses these API calls — payouts and settlement setup work with simulated responses for testing. Switch to production Monnify keys for real validation.

## Team

- **Richard** — backend (API routes, Monnify integration, database, deployment)
- **Nifemi** — frontend (components, pages, store, styling)
- **Makinde** — product definition, AI assistant, documentation
