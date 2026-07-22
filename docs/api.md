# PayProof — API Documentation

Base URL (local): `http://localhost:3000`
All request/response bodies are JSON. All amounts are **integer naira** (no decimals).

---

## Authentication

PayProof uses **JWT Bearer tokens**. Tokens expire in **7 days**.

### `POST /api/auth/register`

Create a seller or buyer account. Sellers get a Monnify reserved virtual account synchronously during registration.

**Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name |
| `contact` | string | yes | Email address (used as login identifier and Monnify customer email) |
| `password` | string | yes | Min 8 characters |
| `role` | string | yes | `"seller"` or `"buyer"` |
| `bvn` | string | required for `seller` | 11-digit Bank Verification Number |

```json
{
  "name": "Ada Okafor",
  "contact": "ada@example.com",
  "password": "securepass123",
  "role": "seller",
  "bvn": "21212121212"
}
```

**Response `201`:**
```json
{
  "user": {
    "id": 1,
    "name": "Ada Okafor",
    "role": "seller",
    "account": {
      "bank": "Wema bank",
      "number": "9928447103",
      "name": "PayProof — Ada Okafor"
    }
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

`account` is present only for `role: "seller"`. Buyer registration returns no `account`.

**Errors:** `400` missing/invalid fields, `409` duplicate email, `429` rate limited (5 per 15 min per IP).

---

### `POST /api/auth/login`

**Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contact` | string | yes | Email used during registration |
| `password` | string | yes | Account password |

```json
{ "contact": "ada@example.com", "password": "securepass123" }
```

**Response `200`:**
```json
{
  "user": { "id": 1, "name": "Ada Okafor", "role": "seller" },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:** `401` invalid credentials, `429` rate limited (10 per 60s per IP).

---

### Auth Header

All authenticated endpoints require:
```
Authorization: Bearer <token>
```

**Rate-limit headers** on 429 responses: `Retry-After`, `X-RateLimit-Reset`.

---

## Health

### `GET /api/health`

No auth. Returns database connectivity and latency.

**Response `200`:**
```json
{
  "status": "ok",
  "db": "connected",
  "latencyMs": 42,
  "ts": "2026-07-22T12:00:00.000Z",
  "version": "0.1.0"
}
```

**Response `503` (DB down):**
```json
{ "status": "degraded", "db": "unreachable", "latencyMs": 5000, "ts": "..." }
```

---

## Seller Profile

### `GET /api/seller/me`

Auth: Bearer token, `role: "seller"` required.

Returns the authenticated seller's profile, reserved account, settlement account (masked), and storefront slug.

**Response `200`:**
```json
{
  "name": "Ada Okafor",
  "store": "Ada Okafor's Store",
  "verified": false,
  "account": {
    "bank": "Wema bank",
    "number": "9928447103",
    "name": "PayProof — Ada Okafor"
  },
  "settlement": {
    "bank": "035",
    "masked": "••••7890",
    "name": "Ada Okafor"
  },
  "typicalOrder": 15000,
  "storefrontSlug": "store-1"
}
```

**Errors:** `401` no auth, `403` non-seller role, `404` account not found.

---

### `GET /api/seller/me/product`

Auth: Bearer token, `role: "seller"` required.

Returns the seller's product listing (one per seller — single-listing MVP).

**Response `200`** (product exists):
```json
{
  "id": "store-1",
  "name": "Premium Widget",
  "price": 15000,
  "description": "A high-quality widget",
  "image": null
}
```

**Response `200`** (no product yet):
```json
null
```

---

### `PUT /api/seller/me/product`

Auth: Bearer token, `role: "seller"` required.

Creates or updates the seller's product. Slug is auto-derived from seller ID (`store-{id}`). On first save, also sets `typicalOrder` to the product price (used by fraud check).

**Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Product name |
| `price` | integer | yes | Positive integer naira |
| `description` | string | yes | Product description |
| `image` | string | no | Base64 data URL (`data:image/...`), max 700KB |

```json
{
  "name": "Premium Widget",
  "price": 15000,
  "description": "A high-quality widget",
  "image": "data:image/png;base64,iVBOR..."
}
```

**Response `200`:**
```json
{
  "id": "store-1",
  "name": "Premium Widget",
  "price": 15000,
  "description": "A high-quality widget",
  "image": "data:image/png;base64,iVBOR..."
}
```

**Errors:** `400` missing/invalid fields, `401` no auth, `403` non-seller.

---

### `PUT /api/seller/me/settlement`

Auth: Bearer token, `role: "seller"` required.

Validates and saves the seller's settlement (payout) bank account. In sandbox mode, validation returns a simulated `"Sandbox Account"` name. In production, calls Monnify's account validation API.

**Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bankCode` | string | yes | Monnify bank code |
| `accountNumber` | string | yes | NUBAN account number |

```json
{ "bankCode": "035", "accountNumber": "1234567890" }
```

**Response `200`:**
```json
{
  "bank": "035",
  "masked": "••••7890",
  "name": "Sandbox Account"
}
```

**Errors:** `400` missing fields or validation failure, `401` no auth, `403` non-seller.

---

## Products (Public)

### `GET /api/products/[slug]`

No auth. Public storefront endpoint. Looks up by `slug` or numeric `id`.

**Response `200`:**
```json
{
  "id": "store-1",
  "name": "Premium Widget",
  "price": 15000,
  "description": "A high-quality widget",
  "image": null,
  "seller": {
    "id": 1,
    "name": "Ada Okafor",
    "store": "Ada Okafor's Store",
    "verified": false
  }
}
```

**Errors:** `404` product not found.

---

## Orders

### `POST /api/orders`

No auth (guest checkout). Creates an order at state `"PendingPayment"`. Optionally authenticated — if a valid Bearer token is provided for a buyer role, `buyerId` is recorded server-side.

Rate-limited: 20 orders per 60s per IP.

**Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `buyerName` | string | yes | Buyer's display name |
| `productSlug` | string | yes | Product slug from `/api/products/[slug]` |
| `phone` | string | no | Buyer's phone number |

```json
{
  "buyerName": "Tobi Adeyemi",
  "productSlug": "store-1",
  "phone": "08051234567"
}
```

**Response `201`:**
```json
{
  "order": {
    "id": "PP-A1FA0C13DBF1",
    "ref": "MNFY-CDE3430E",
    "buyer": "Tobi Adeyemi",
    "phone": "08051234567",
    "item": "Premium Widget",
    "amount": 15000,
    "state": "PendingPayment",
    "flagged": false,
    "timestamps": { "PendingPayment": "2026-07-22T12:00:00.000Z" }
  }
}
```

**Errors:** `400` missing fields or invalid product slug, `429` rate limited.

---

### `GET /api/orders`

Auth: Bearer token, `role: "seller"` required.

Returns all orders belonging to the authenticated seller, ordered by newest first.

**Response `200`:**
```json
[
  {
    "id": "PP-A1FA0C13DBF1",
    "ref": "MNFY-CDE3430E",
    "buyer": "Tobi Adeyemi",
    "phone": "08051234567",
    "item": "Premium Widget",
    "amount": 15000,
    "state": "PendingPayment",
    "flagged": false,
    "timestamps": { "PendingPayment": "2026-07-22T12:00:00.000Z" }
  }
]
```

**Errors:** `401` no auth, `403` non-seller role.

---

### `GET /api/orders/buyer`

Auth: Bearer token, `role: "buyer"` required.

Returns all orders placed by the authenticated buyer.

**Response `200`:**
```json
[
  {
    "id": "PP-A1FA0C13DBF1",
    "ref": "MNFY-CDE3430E",
    "buyer": "Tobi Adeyemi",
    "phone": "08051234567",
    "item": "Premium Widget",
    "amount": 15000,
    "state": "PendingPayment",
    "flagged": false,
    "timestamps": { "PendingPayment": "2026-07-22T12:00:00.000Z" }
  }
]
```

**Errors:** `401` no auth, `403` non-buyer role.

---

### `GET /api/orders/[id]`

No auth (capability URL — the order ID serves as access token). Returns the full order with seller details. **Settlement account is masked for non-sellers** — only the seller who owns the order sees the unmasked settlement.

**Response `200` (public view):**
```json
{
  "id": "PP-A1FA0C13DBF1",
  "ref": "MNFY-CDE3430E",
  "buyer": "Tobi Adeyemi",
  "phone": "08051234567",
  "item": "Premium Widget",
  "amount": 15000,
  "state": "Paid",
  "flagged": false,
  "timestamps": {
    "PendingPayment": "2026-07-22T12:00:00.000Z",
    "Paid": "2026-07-22T12:05:00.000Z"
  },
  "seller": {
    "name": "Ada Okafor",
    "store": "Ada Okafor's Store",
    "verified": false,
    "account": {
      "bank": "Wema bank",
      "number": "9928447103",
      "name": "PayProof — Ada Okafor"
    },
    "storefrontSlug": "store-1"
  }
}
```

**Response `200` (seller view — includes `settlement`):**
```json
{
  "id": "PP-A1FA0C13DBF1",
  ...,
  "seller": {
    ...,
    "settlement": {
      "bank": "035",
      "masked": "••••7890",
      "name": "Ada Okafor"
    }
  }
}
```

**Response `404`:** `{ "error": "Order PP-NONEXISTENT not found.", "code": "NOT_FOUND" }`

---

## Order State Transitions

### Order State Machine

```
PendingPayment → Paid → AwaitingShipment → Shipped → Delivered → Completed
```

| State | Description |
|-------|-------------|
| `PendingPayment` | Order created, awaiting payment |
| `Paid` | Payment received (set by webhook or simulate) |
| `AwaitingShipment` | Payment confirmed, awaiting seller to ship |
| `Shipped` | Seller marked as shipped |
| `Delivered` | Buyer confirmed delivery |
| `Completed` | Delivery confirmed, order complete |

All states are stored as **exact PascalCase strings** (no spaces). Each transition is stamped in the `timestamps` JSON object.

---

### `POST /api/orders/[id]/ship`

Auth: Bearer token, `role: "seller"` required, must own the order.

Precondition: order state is `"AwaitingShipment"`.

**Request:** No body.

**Response `200`:** updated order with state `"Shipped"` and new timestamp.

**Errors:** `400` invalid transition (wrong current state), `401` no auth, `403` wrong seller or non-seller, `404` order not found.

---

### `POST /api/orders/[id]/confirm-delivery`

Auth: Optional — depends on whether the order is anonymous.

- **Anonymous orders** (`buyerId === null`): no auth required (capability URL).
- **Signed-in buyer orders** (`buyerId` is set): requires Bearer token matching the buyer. Sellers **cannot** confirm delivery on their own orders.

Precondition: order state is `"Shipped"`.

Effect: advances `Shipped → Delivered → Completed` in a single atomic transaction, stamping both timestamps.

**Request:** No body.

**Response `200`:** updated order with state `"Completed"` and both new timestamps.

**Errors:** `400` invalid transition, `401` auth required for non-anonymous order, `403` wrong buyer or seller attempting, `404` order not found.

---

## Monnify Payment

### `POST /api/monnify/simulate` (sandbox only)

Sandbox-only endpoint. Simulates a payment by advancing order state `PendingPayment → Paid → AwaitingShipment` in a single atomic transaction. Runs fraud check. **Not available in production** (returns 403).

**Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | string | * | Order ID to simulate payment for |
| `sellerId` | integer | * | Seller ID (alternative to `orderId`, requires `amount`) |
| `amount` | integer | * | Amount to match (alternative, requires `sellerId`) |

At least one of `orderId` or `sellerId+amount` must be provided.

```json
{ "orderId": "PP-A1FA0C13DBF1" }
```

**Response `200`:**
```json
{
  "status": "ok",
  "orderId": "PP-A1FA0C13DBF1",
  "transactionRef": "SIM-PP-A1FA0C13DBF1-1784697913118",
  "amount": 15000,
  "flagged": false,
  "flagReason": null
}
```

**Errors:** `400` invalid order state (not PendingPayment), `403` not sandbox mode, `404` no matching order.

---

### `POST /api/monnify/webhook`

Monnify payment notification callback. Receives HTTP POST from Monnify when a payment is completed into a reserved account.

**Security:**
- Production: IP whitelist (`35.242.133.146`), HMAC signature verification via `monnify-signature` header, transaction re-verification against Monnify API.
- Sandbox: HMAC skipped (no header sent), IP check skipped.

**Flow:**
1. Parse raw JSON body
2. Validate `eventType === "SUCCESSFUL_TRANSACTION"`
3. Atomic dedup via `WebhookEvent` table (idempotency key = `transactionReference`)
4. Parse `accountReference` to extract `sellerId` (format: `PAYPROOF-USER-{id}-...`)
5. Find pending order by `sellerId` + exact `amountPaid` match
6. Re-verify transaction against Monnify API (`verifyTransaction`)
7. Run fraud check: flags if `amountPaid > 5 × seller.typicalOrder`
8. Atomic transaction: advance `PendingPayment → Paid → AwaitingShipment`, mark webhook event processed

**Request:** Raw Monnify webhook payload.

**Response:** Always `200` with `"OK"` (Monnify only cares about the status code; errors are logged server-side).

**Replays:** Use `POST /api/monnify/replay` to retry a previously received event.

---

### `POST /api/monnify/replay` (sandbox only)

Replays a previously received webhook event. Looks up the event by `transactionReference` in the `WebhookEvent` table and re-runs `handleNotification`.

**Request:**
```json
{ "transactionReference": "MNFY-..." }
```

**Response `200`:**
```json
{ "status": "ok", "transactionReference": "MNFY-..." }
```

**Errors:** `400` missing reference, `403` not sandbox mode, `404` no event found.

---

## Payouts

### `POST /api/payouts/validate-bank`

Auth: Bearer token, `role: "seller"` required.

Validates a bank account via Monnify. In sandbox mode, returns a simulated `"Sandbox Account"`.

**Request:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bankCode` | string | yes | Monnify bank code |
| `accountNumber` | string | yes | NUBAN account number |

```json
{ "bankCode": "035", "accountNumber": "1234567890" }
```

**Response `200` (sandbox):**
```json
{
  "bankCode": "035",
  "accountNumber": "1234567890",
  "accountName": "Sandbox Account"
}
```

**Errors:** `400` missing fields or validation failure, `401` no auth, `403` non-seller.

---

### `POST /api/payouts/release/[id]`

Auth: Bearer token, `role: "seller"` required, must own the order.

Releases payout to the seller's settlement account. Uses an atomic `payoutClaimedAt` guard to prevent double-payouts.

Preconditions:
- Order state is `"Completed"`
- Seller has a settlement account configured (`PUT /api/seller/me/settlement`)

In sandbox mode, the transfer is simulated (no real Monnify API call). In production, calls Monnify's `singleTransfer` API.

**Request:** No body.

**Response `200` (sandbox):**
```json
{
  "orderId": "PP-A1FA0C13DBF1",
  "amount": 15000,
  "payoutRef": "PAYOUT-PP-A1FA0C13DBF1-1784698022920",
  "transferStatus": "SANDBOX-SIMULATED",
  "destinationBank": "035",
  "destinationAccount": "1234567890",
  "destinationName": "Sandbox Account"
}
```

**Errors:** `400` order not completed or no settlement account, `401` no auth, `403` wrong seller, `404` order not found, `409` payout already claimed.

---

## Error Shape

All non-2xx responses follow this structure:
```json
{
  "error": "Human-readable explanation.",
  "code": "MACHINE_READABLE_CODE"
}
```

### Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Missing or invalid request fields |
| `INVALID_TRANSITION` | 400 | Order state does not allow the requested transition |
| `AUTH_REQUIRED` | 401 | No valid Bearer token |
| `FORBIDDEN` | 403 | Token present but wrong role or not the owner |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Payout already claimed or duplicate resource |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error (includes `requestId` for debugging) |

---

## Order State Strings (Exact)

```
PendingPayment  Paid  AwaitingShipment  Shipped  Delivered  Completed
```

These exact strings are used in the `state` field and as keys in the `timestamps` JSON object. No spaces, no casing drift.

---

## Sandbox vs Production Behavior

| Feature | Sandbox (`MONNIFY_BASE_URL` contains `sandbox`) | Production |
|---------|--------------------------------------------------|------------|
| Reserved accounts | Real Monnify API called | Real Monnify API called |
| Bank validation | Returns simulated `"Sandbox Account"` | Real Monnify validation |
| Payout transfer | Simulated | Real `singleTransfer` |
| Webhook HMAC | Skipped (no header) | Required and verified |
| Webhook IP check | Skipped | Restricted to `35.242.133.146` |
| `/api/monnify/simulate` | Available | Returns 403 |
| `/api/monnify/replay` | Available | Returns 403 |
