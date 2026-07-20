# PayProof — Contract Decisions (Day 1)

Resolves the 12 unresolved items in `API_CONTRACT.md`. Owner: Makinde.
These are final for the hackathon build — do not re-litigate mid-build.

| # | Question | Decision |
|---|---|---|
| 1 | Auth | Seller: JWT auth (register/login/me). Buyer: **no account**, guest checkout only. |
| 2 | Who can create an order | Anyone, unauthenticated. `POST /api/orders` is open. |
| 3 | Buyer identity | Stays a display string + phone on the order. No `userId`, no buyer table. |
| 4 | Checkout phone | Now part of the real request: `{ productId, buyerName, phone }`. No longer discarded. |
| 5 | Hardcoded `productId` | Left as-is. One product per seller is explicit MVP scope, not a bug. |
| 6 | Fraud rule | Implemented in the webhook handler: flag if `amount > 5 × seller.typicalOrder`. Sets `flagged: true` and a generated `flagReason` string. |
| 7 | Error contract | Adopted: non-2xx responses return `{ "error": { "message": "…" } }`. |
| 8 | Assistant: server or client | Stays **client-side, deterministic** (`lib/assistant.js` keyword rules). No LLM API call in the critical path. Reads real polled order data, not seed data, by Day 3. |
| 9 | Money units | Integer naira in DB and frontend, everywhere. Conversion to Monnify's decimal format happens **only inside `services/monnify.ts`**, at the API call boundary. |
| 10 | Order `id` / `ref` | Backend generates both server-side on `POST /orders`. Client never supplies or trusts these. |
| 11 | "Completed" timing | Instant, backend-driven, on `POST /orders/:id/confirm-delivery`. No artificial settlement delay. |
| 12 | Order URL privacy | Unguessable order ID = capability URL. No auth gate on `GET /orders/:id` or `/pay/:id`. |

## Repo structure decision

Nifemi's existing Next.js repo layout (`app/`, `components/`, `lib/`, `public/`) is **kept as-is**. No monorepo restructure.

- Frontend: existing Next.js app, deployed to Vercel.
- Backend: new `/server` folder in the **same repo**, Express + Prisma, deployed separately (Render/Railway).
- Two deploy targets, one repo. CORS must be explicitly configured between them — flag this on the Day 3 deployment checklist, it's the main risk this decision introduces.

## Scope cut, made official

"Buyer/seller auth" in the original Part 1 scope doc is amended to **seller auth only**. Buyer authentication is formally out of scope for this build, not deferred — guest checkout via capability URL is the permanent design for this MVP.
