# PayProof — API Contract (extracted from the frontend)

**Read this first:** the frontend has **no network layer at all**. There is not a single
`fetch`, `axios`, `WebSocket`, or `EventSource` call in the codebase (verified by search).
Every screen runs on a React context (`lib/store.jsx`) backed by `localStorage`
(key `payproof-demo-v1`, shape `{ orders, product }`). The mock data below is therefore
the de facto contract — field names are reported **verbatim from the code**, including
the inconsistent ones.

The whole client surface is consolidated in **`lib/api.js`** (one function per route
below, currently mock-backed). Wiring the real backend = replacing those function
bodies with `fetch()` calls. No component imports data from anywhere else.

Everything here is camelCase. All amounts are **integer naira** (`48500` = ₦48,500 —
no kobo anywhere; see Unresolved #10). All timestamps are ISO-8601 strings.

---

## 1. Route table

| Method | Path | Purpose | Auth required |
|---|---|---|---|
| POST | /api/auth/register | Create buyer or seller account; seller response must include the Monnify reserved account | No |
| POST | /api/auth/login | Sign in | No |
| GET | /api/seller/me | Seller profile: store, reserved account, masked settlement account | Seller |
| GET | /api/products/:id | Public storefront listing (one product per seller in MVP) | No |
| PUT | /api/products/:id | Create/update the seller's single listing | Seller |
| POST | /api/orders | Create order at "Pending Payment"; server issues `id` and `ref` | Open — see Unresolved #2 |
| GET | /api/orders | Order list (seller: all their orders; buyer: their purchases) | Yes |
| GET | /api/orders/:id | Single order — **this is the live-update polling target** | Open — see Unresolved #12 |
| POST | /api/orders/:id/ship | Seller marks shipped ("Awaiting Shipment" → "Shipped") | Seller |
| POST | /api/orders/:id/confirm-delivery | Buyer confirms ("Shipped" → "Delivered"; settlement then drives "Delivered" → "Completed") | Buyer |
| POST | /api/monnify/webhook | Monnify → backend only. Flips "Pending Payment" → "Paid" → "Awaiting Shipment", stamps timestamps, runs the fraud rule | n/a (Monnify signature) |
| POST | /api/orders/:id/assistant | Order-scoped assistant Q&A — **only if** the assistant moves server-side (Unresolved #8) | Open |

`lib/api.js` mapping: `api.auth.register/login`, `api.seller.me`, `api.products.get/save`,
`api.orders.list/get/create/markShipped/confirmDelivery`, `api.assistant.ask`.
`api.orders._advance` and `api.reset` are mock-only (they simulate backend-driven
transitions / reseed the demo) and must **not** become routes.

## 2. Request/response shapes (verbatim field names)

### Order — the core object (from `lib/api.js` seeds and `create`)

```jsonc
{
  "id": "PP-3419-12",            // string. MOCK GENERATES THIS CLIENT-SIDE with Math.random — backend must own it
  "ref": "MNFY-80293419",        // string. Monnify transaction reference. ALSO mock-generated — backend must own it
  "buyer": "Tobi Adeyemi",       // string display name. THERE ARE NO USER IDS — see Unresolved #3
  "item": "Ultraboost Light (core black, 44)",  // denormalized product NAME copied at order time (not a product id)
  "amount": 22500,               // integer naira
  "state": "Shipped",            // exactly one of the six strings in §5
  "flagged": false,              // boolean
  "flagReason": "₦250,000 is about 12× Ada’s typical order of ₦20,500.",  // string, present only when flagged
  "timestamps": {                // keys are the EXACT state strings, spaces included
    "Pending Payment": "2026-07-16T04:21:09.000Z",
    "Paid": "2026-07-16T05:21:09.000Z",
    "Awaiting Shipment": "2026-07-16T05:21:09.000Z",
    "Shipped": "2026-07-17T01:21:09.000Z"
  }
}
```

The UI renders the timeline purely from `state` + `timestamps` — reproduce both exactly.

### Product (`api.products.get/save`)

```jsonc
{
  "id": "aj1-low",               // NOTE: hardcoded in nav links — see Unresolved #5
  "name": "Air Jordan 1 Low (Panda)",
  "price": 48500,                // integer naira
  "description": "Brand new in box, UK 9. …",
  "image": null                  // null (UI shows a default sketch) OR a base64 data URL — see §7
}
```

### Seller profile (`api.seller.me`)

```jsonc
{
  "name": "Ada Okafor",
  "store": "Ada’s Store",
  "verified": true,              // drives the brass hallmark badge
  "account": {                   // the Monnify reserved account — shown on onboarding, dashboard, pay screen
    "bank": "Wema Bank",
    "number": "9928447103",      // 10-digit NUBAN as a string; UI formats as "9928 4471 03"
    "name": "PayProof — Ada Okafor"
  },
  "settlement": {
    "bank": "GTBank",
    "masked": "••••1234",        // the mock literally stores the masked string; real API should mask server-side
    "name": "Ada Okafor"
  },
  "typicalOrder": 20500          // used only in fraud-flag copy today (see Unresolved #6)
}
```

### Auth (`api.auth.*`) — collected by the forms today

```jsonc
// POST /api/auth/register — request (fields exactly as the form collects them)
{ "name": "Ada Okafor", "contact": "0803 123 4567", "password": "…", "role": "seller" }
// "contact" is ONE field meaning phone-or-email — that is a real UI decision, honor it or split the form later
// "role" is "seller" | "buyer" (segmented control)

// POST /api/auth/login — request
{ "contact": "0803 123 4567", "password": "…" }

// response (both) — what the mock returns; the real shape is Unresolved #1
{ "user": { "name": "Ada Okafor", "role": "seller" }, "token": null }
// For role=seller, register must ALSO return the reserved account (the seal-reveal
// screen shows it immediately after registration).
```

### Create order (`api.orders.create`)

```jsonc
// request — all the frontend sends today
{ "buyerName": "Tobi Adeyemi" }
// The checkout form ALSO collects a phone number and then DISCARDS it (Unresolved #4).
// The real request should be { productId, buyerName, phone }.

// response
{ "order": { /* Order, state "Pending Payment" */ } }
// The mock also returns "orders" (full list) purely so React state can sync — not part of the real contract.
```

### Actions (`api.orders.markShipped` / `confirmDelivery`)

Request: empty body. Response: the updated `Order`. State moves "Awaiting Shipment"→"Shipped"
and "Shipped"→"Delivered" respectively, with the new timestamp stamped.

### Assistant (`api.assistant.ask`)

```jsonc
// request
{ "question": "Is this payment verified?" }
// response
{ "answer": "Yes — this payment was confirmed by the bank on 17 Jul, 14:32, reference MNFY-…" }
```

Suggestion chips (`suggestionsFor` in `lib/assistant.js`) are client-side presentation and
stay client-side either way.

## 3. Auth handling

**Nothing is implemented.** No token exists, nothing is stored (not localStorage, not
cookies, not memory), nothing is attached to any request, and no route is guarded.
The login form navigates to `/seller` regardless of input; register branches only on the
role toggle (`seller` → `/seller/welcome`, `buyer` → `/buyer`). The login page also has
two "demo account" quick links. All of Task 3 is **Unresolved #1** — the shapes above are
what the forms collect, not a settled auth design.

## 4. Live update — what was actually built, and the decision

**What's in the code:** three `setTimeout` chains that *simulate the backend*. No polling,
no WebSocket, no SSE.

1. `app/pay/[orderId]/page.js` — effect: order at "Pending Payment" → after **6500ms** →
   "Paid" (the seal stamps).
2. Same file, second effect: at "Paid" → after **3200ms** → "Awaiting Shipment".
3. `lib/store.jsx` `confirmDelivery` — after **2600ms** → "Completed" (settlement).

Known mock quirks (don't reproduce): leaving the pay screen mid-wait cancels the timer and
a revisit restarts it; reloading within the 2600ms settlement window strands the order at
"Delivered" forever. Both artifacts of client-side timers.

**Decision (made here so the webhook handler isn't blocked): short-interval polling.**
The frontend will poll `GET /api/orders/:id` every **3000ms** while the pay screen or an
order detail screen is open and the order is in a non-terminal state (anything but
"Completed"). The Monnify webhook handler therefore only has to **write the new `state`
and `timestamps` to the database** — no push infrastructure, no socket server. The three
timers above are the exact swap points: delete them, add one poll hook that calls
`api.orders.get(id)` and updates state. If the team later wants sub-second stamps for the
demo, upgrade the same hook to SSE — the contract doesn't change.

## 5. Order state strings

Single source: `ORDER_STATES` in `lib/orders.js`. Exact values, used everywhere:

```
"Pending Payment", "Paid", "Awaiting Shipment", "Shipped", "Delivered", "Completed"
```

These strings are also the `timestamps` keys (spaces included) and are stored verbatim in
localStorage. Consistent across all files — no casing drift found. Three near-misses to
not trip on:

- Status chips render UPPERCASE, but that's CSS `text-transform` (`.caption`) — the
  underlying strings stay title-case.
- The seal displays "PAID" — display copy, not a state value.
- `components/StatusChip.jsx` has a style key `"Flagged"` that is **not a state** — the
  fraud flag is the boolean `flagged` on the order (rendered as an icon + panel), and that
  chip style is currently unused.
- The landing page (`app/page.js`) hardcodes three sample ledger rows using the same
  strings — marketing copy, not data.

## 6. Error handling

**No response-error shape exists** — there are no requests. What the code actually does
on failure today:

- Clipboard copy: `try/catch` → fallback toast that shows the account number inline.
- `localStorage` read/write: `try/catch` → falls back to seed data / keeps working
  in-memory (a too-large product photo silently doesn't persist).
- Unknown order id on `/pay/:id` and `/orders/:id`: a proper "Order not found" screen
  with a route back.

There is no retry logic and no network-error toast pattern. The error contract is
**Unresolved #7** — proposal: non-2xx with `{ "error": { "message": "…" } }`, surfaced
through the existing toast, but that is a proposal, not code.

## 7. Image upload

`app/seller/product/page.js` reads the chosen file with `FileReader.readAsDataURL` and
stores the **base64 data URL string directly in `product.image`**, which then goes into
localStorage with everything else (and silently fails to persist if it blows the quota).
No endpoint, no multipart, no presigned URL — transport is **Unresolved #9**. Note the
UI treats `image: null` as "use the default sketch", so the field must stay nullable.

## 8. Unresolved — stubbed on the fly, not decided

1. **Auth, entirely.** No token, storage, guard, or session anywhere. Login always lands
   on `/seller`. The register/login request bodies in §2 reflect the forms, nothing more.
2. **Who may create an order.** Checkout has no login step — buyers are anonymous today.
   Decide: guest checkout with phone, or buyer accounts required.
3. **Buyer identity is a display-name string.** The buyer dashboard filters
   `order.buyer === "Tobi Adeyemi"`. No user ids exist on orders. Backend must add a real
   buyer reference; `buyer` as a display string can stay for rendering.
4. **Checkout phone number is collected and thrown away.** It's in the form, never stored.
5. **`productId` is hardcoded.** Nav links and CTAs point at `/p/aj1-low` literally
   (AppHeader, dashboards, not-found screens). Orders store the product *name*, not an id.
   Fine for single-listing MVP; breaks the moment there are two products.
6. **The fraud rule is not implemented.** Seed order `PP-3557-04` ships with
   `flagged: true` and a hand-written `flagReason` so the UI could be built. No code
   computes the "N× typical order" rule; `SELLER.typicalOrder` exists only for that copy.
   Intended evaluation point is the webhook (on payment confirmation), but that was never
   actually decided.
7. **Error contract** — see §6.
8. **Assistant: server or client?** Current implementation is fully client-side and
   deterministic (`lib/assistant.js`, keyword rules over the order record) with a fake
   700ms delay. It could ship as-is with zero backend. The `/assistant` route exists in
   the table only in case the team wants answers grounded in server truth.
9. **Image upload transport** — see §7.
10. **Money unit convention.** The frontend uses integer naira everywhere. Monnify's API
    speaks decimal naira amounts — someone must pin the conversion at the backend boundary
    before real payments flow.
11. **"Completed" timing.** The Delivered→Completed transition is a 2.6s client timer
    standing in for settlement. Real settlement timing/semantics (instant on confirm?
    after Monnify disbursement callback?) was never decided.
12. **Order-page privacy.** `/orders/:id` and `/pay/:id` are readable by anyone with the
    URL (that's also how Ada shares the pay link with Tobi today). Decide whether order
    ids are unguessable-and-shareable (capability URLs) or auth-gated.
