# PayProof — API Documentation

Base URL (local): `http://localhost:4000`
All request/response bodies are JSON. All amounts are **integer naira** (no kobo) except inside `services/monnify.ts`, which converts at the boundary. See `CONTRACT_DECISIONS.md` for the reasoning behind every design choice below.

---

## Auth

### `POST /api/auth/register`
Seller or buyer account. **Only sellers actually get an account** — see decision #1. Buyer registration is not part of this build; this route exists for the seller path.

Request:
```json
{ "name": "Ada Okafor", "contact": "0803 123 4567", "password": "...", "role": "seller" }
```
`role` is always `"seller"` in practice.

Response `201`:
```json
{
  "user": { "id": "usr_...", "name": "Ada Okafor", "role": "seller" },
  "token": "eyJ...",
  "account": {
    "bank": "Wema Bank",
    "number": "9928447103",
    "name": "PayProof — Ada Okafor"
  }
}
```
`account` is the Monnify reserved account, created synchronously during registration. If reserved account creation fails, the whole registration fails — do not create a seller without one.

### `POST /api/auth/login`
Request: `{ "contact": "0803 123 4567", "password": "..." }`
Response `200`: `{ "user": { "id", "name", "role" }, "token": "eyJ..." }`

### `GET /api/seller/me`
Auth: Bearer token, seller role required.

Response `200`:
```json
{
  "name": "Ada Okafor",
  "store": "Ada's Store",
  "verified": true,
  "account": { "bank": "Wema Bank", "number": "9928447103", "name": "PayProof — Ada Okafor" },
  "settlement": { "bank": "GTBank", "masked": "••••1234", "name": "Ada Okafor" },
  "typicalOrder": 20500
}
```

---

## Products

### `GET /api/products/:id`
No auth. Public storefront listing.

Response `200`:
```json
{ "id": "aj1-low", "name": "Air Jordan 1 Low (Panda)", "price": 48500, "description": "...", "image": null }
```
`image` is `null` or a base64 data URL (transport is unresolved long-term — fine for MVP, see contract §7).

### `PUT /api/products/:id`
Auth: Bearer token, seller role, must own the product.
Request: same shape as the GET response, minus `id`.
Response `200`: the updated product.

---

## Orders

### `POST /api/orders`
No auth (guest checkout — decision #2).

Request:
```json
{ "productId": "aj1-low", "buyerName": "Tobi Adeyemi", "phone": "0805 555 1234" }
```

Response `201`:
```json
{
  "order": {
    "id": "PP-3419-12",
    "ref": "MNFY-80293419",
    "buyer": "Tobi Adeyemi",
    "phone": "0805 555 1234",
    "item": "Air Jordan 1 Low (Panda)",
    "amount": 48500,
    "state": "Pending Payment",
    "flagged": false,
    "timestamps": { "Pending Payment": "2026-07-18T09:00:00.000Z" }
  }
}
```
`id` and `ref` are **always server-generated** (decision #10). Never accept these from the client.

### `GET /api/orders`
Auth: Bearer token. Seller sees all their orders; buyer access is not authenticated (see `GET /api/orders/:id` below for how buyers actually check status).

### `GET /api/orders/:id`
No auth — capability URL (decision #12). **This is the live-update polling target.** Frontend polls this every 3000ms while an order is non-terminal.

Response `200`: full `Order` object, same shape as above.

Response `404`:
```json
{ "error": { "message": "Order not found" } }
```

### `POST /api/orders/:id/ship`
Auth: Bearer token, seller role, must own the order.
Preconditions: order state is `"Awaiting Shipment"`.
Response `200`: updated order, state now `"Shipped"`, new timestamp stamped.

### `POST /api/orders/:id/confirm-delivery`
No auth (capability URL — same buyer who received the pay link).
Preconditions: order state is `"Shipped"`.
Effect: state → `"Delivered"`, then immediately → `"Completed"` server-side (decision #11 — no artificial delay). Both timestamps are stamped in the same request.
Response `200`: updated order.

---

## Monnify webhook

### `POST /api/monnify/webhook`
Auth: Monnify signature verification (HMAC), not a bearer token. Reject with `401` on signature mismatch — do not process the payload.

Flow:
1. Verify signature.
2. Verify the transaction against Monnify's API (never trust the webhook payload alone — call Monnify to confirm).
3. Look up order by `ref`.
4. Run fraud rule: if `amount > 5 × seller.typicalOrder`, set `flagged: true` and generate `flagReason` (decision #6), e.g. `"₦{amount} is about {n}× {seller}'s typical order of ₦{typicalOrder}."`
5. Update order state: `"Pending Payment"` → `"Paid"` → `"Awaiting Shipment"`, stamping both timestamps.
6. Create a `Payment` record.

Response: `200` with an empty body on success — Monnify only cares about the status code.

---

## Payout

### `POST /api/payouts/release`
Auth: Bearer token, seller role, must own the order.
Preconditions: order state is `"Completed"`.
Response `200`:
```json
{ "reference": "PAYOUT-...", "status": "success", "amount": 48500 }
```
If sandbox payout isn't reliably available, simulate the transfer and set `status: "simulated"` — document this clearly, do not hide it. See `contingency` section in demo-script.md.

---

## Assistant

### `POST /api/orders/:id/assistant`
Client-side only in this build (decision #8) — **this route is documented for completeness but is not called.** `lib/assistant.js` answers from the polled order record directly in the browser. No LLM API call sits in the critical path of the payment flow.

---

## Error shape

Every non-2xx response:
```json
{ "error": { "message": "Human-readable explanation" } }
```

## Order state strings — exact, used everywhere

```
"Pending Payment", "Paid", "Awaiting Shipment", "Shipped", "Delivered", "Completed"
```
These are also the exact keys in the `timestamps` object. Spaces included. No abbreviation, no casing drift.
