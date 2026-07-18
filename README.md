# PayProof — frontend

Every sale verified by Monnify, not by screenshots. This is the frontend build from the
master build prompt — Next.js (App Router) + Tailwind v4, custom components, no UI kit.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Demo flow (the judge walk)

1. `/` — landing: fake-screenshot vs stamped-seal argument.
2. `/register` — pick **Sell** → the Seal reveal (`/seller/welcome`): Ada's reserved
   account number stamps onto the page.
3. `/seller` — the ledger: reserved-account card (always on top), orders table,
   **Mark as Shipped**, masked settlement account.
4. `/seller/product` — one listing, live buyer preview.
5. `/p/aj1-low` — what Tobi sees → **Proceed to Secure Payment** → checkout.
6. `/pay/[orderId]` — **the centerpiece**: waiting state, then the PAID seal stamps
   itself when the payment confirmation lands (simulated ~6.5s; no refresh, no button).
7. `/orders/[id]` — six-state timeline, payment record, fraud flag (see `PP-3557-04`),
   inline order-scoped assistant.
8. `/buyer` — Tobi's orders → **Confirm Delivery** on the Shipped one → watch it settle
   to Completed on its own.

"Reset demo data" in the app footer reseeds everything.

## Where things live

- Design tokens: `app/globals.css` (`@theme` — Parchment/Paper/Ink/Bottle/Brass/Rust,
  radii, the seal-stamp keyframes). Fonts load in `app/layout.js` via `next/font`.
- The Seal: `components/Seal.jsx` — used in exactly three places (account reveal,
  Paid moment, verified badge). Don't add a fourth.
- Order state machine + demo store: `lib/orders.js`, `lib/store.jsx`
  (React context + localStorage; swap for real API calls later).
- Assistant answers: `lib/assistant.js` — deterministic and rule-based on purpose.

## Wiring the real backend

The whole client API surface lives in **`lib/api.js`** — one function per backend
route, currently backed by the localStorage mock. Swap those function bodies for
`fetch()` calls, and replace the three demo timers (two in
`app/pay/[orderId]/page.js`, the settlement one in `lib/store.jsx`) with polling
`GET /api/orders/:id` — nothing else in the app changes. The UI renders purely
from order `state` + `timestamps`.

Full route table, request/response shapes, exact state strings, and the honest
list of undecided things: **`API_CONTRACT.md`**.
