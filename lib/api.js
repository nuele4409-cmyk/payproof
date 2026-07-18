// PayProof API client — the single surface every component talks through.
// Each function mirrors one backend route documented in API_CONTRACT.md.
// Today every body is the demo mock (localStorage-backed). Wiring the real
// backend means replacing these bodies with fetch() calls — components,
// signatures, and return shapes stay exactly as they are.

import { answerFor } from "./assistant";

const STORAGE_KEY = "payproof-demo-v1";

/**
 * @typedef {Object} Order
 * @property {string} id            e.g. "PP-3419-12" (mock: client-generated — backend must own this)
 * @property {string} ref           e.g. "MNFY-80293419" (mock: client-generated — backend must own this)
 * @property {string} buyer         display name, e.g. "Tobi Adeyemi" (no user ids exist yet)
 * @property {string} item          denormalized product name at time of order
 * @property {number} amount        integer naira (48500 = ₦48,500)
 * @property {string} state         one of ORDER_STATES in lib/orders.js
 * @property {boolean} flagged
 * @property {string} [flagReason]  present only when flagged
 * @property {Record<string,string>} timestamps  ISO strings keyed by the exact state strings
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {number} price         integer naira
 * @property {string} description
 * @property {string|null} image    null (default sketch) or a base64 data URL
 */

export const SELLER = {
  name: "Ada Okafor",
  store: "Ada’s Store",
  verified: true,
  account: {
    bank: "Wema Bank",
    number: "9928447103",
    name: "PayProof — Ada Okafor",
  },
  settlement: { bank: "GTBank", masked: "••••1234", name: "Ada Okafor" },
  typicalOrder: 20500,
};

export const BUYER = { name: "Tobi Adeyemi" };

function daysAgo(days, hours = 0) {
  const t = new Date();
  t.setDate(t.getDate() - days);
  t.setHours(t.getHours() - hours);
  return t.toISOString();
}

export const SEED_PRODUCT = {
  id: "aj1-low",
  name: "Air Jordan 1 Low (Panda)",
  price: 48500,
  description:
    "Brand new in box, UK 9. Lagos delivery within 48 hours, nationwide 3–5 days. Your payment is held by PayProof until you confirm delivery.",
  image: null,
};

const SEED_ORDERS = [
  {
    id: "PP-3557-04",
    ref: "MNFY-81143557",
    buyer: "K. Musa",
    item: "iPhone 13 Pro (128GB, graphite)",
    amount: 250000,
    state: "Awaiting Shipment",
    flagged: true,
    flagReason: "₦250,000 is about 12× Ada’s typical order of ₦20,500.",
    timestamps: {
      "Pending Payment": daysAgo(0, 3),
      Paid: daysAgo(0, 2),
      "Awaiting Shipment": daysAgo(0, 2),
    },
  },
  {
    id: "PP-3419-12",
    ref: "MNFY-80293419",
    buyer: "Tobi Adeyemi",
    item: "Ultraboost Light (core black, 44)",
    amount: 22500,
    state: "Shipped",
    flagged: false,
    timestamps: {
      "Pending Payment": daysAgo(2, 3),
      Paid: daysAgo(2, 3),
      "Awaiting Shipment": daysAgo(2, 3),
      Shipped: daysAgo(1, 6),
    },
  },
  {
    id: "PP-3102-88",
    ref: "MNFY-73013102",
    buyer: "Tobi Adeyemi",
    item: "Air Max 97 (silver, 43)",
    amount: 18500,
    state: "Completed",
    flagged: false,
    timestamps: {
      "Pending Payment": daysAgo(6, 5),
      Paid: daysAgo(6, 4),
      "Awaiting Shipment": daysAgo(6, 4),
      Shipped: daysAgo(5, 2),
      Delivered: daysAgo(3, 1),
      Completed: daysAgo(3, 1),
    },
  },
];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return {
        orders: Array.isArray(data.orders) ? data.orders : SEED_ORDERS,
        product: data.product || SEED_PRODUCT,
      };
    }
  } catch {
    // fall through to seeds
  }
  return { orders: SEED_ORDERS, product: SEED_PRODUCT };
}

function persist(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full (large photo) — demo keeps working in memory
  }
}

function withState(order, state) {
  return {
    ...order,
    state,
    timestamps: { ...order.timestamps, [state]: new Date().toISOString() },
  };
}

export const api = {
  // ——— POST /api/auth/register · POST /api/auth/login ———
  // Mock: no account exists, no token is issued (see API_CONTRACT.md → Unresolved).
  auth: {
    async register({ name, role } = {}) {
      return { user: { name: name || (role === "buyer" ? BUYER.name : SELLER.name), role }, token: null };
    },
    async login() {
      return { user: { name: SELLER.name, role: "seller" }, token: null };
    },
  },

  // ——— GET /api/seller/me ———
  seller: {
    async me() {
      return SELLER;
    },
  },

  products: {
    // GET /api/products/:id — single-listing MVP: the id is accepted but ignored by the mock
    async get() {
      return load().product;
    },
    // PUT /api/products/:id
    async save(product) {
      const data = load();
      data.product = product;
      persist(data);
      return product;
    },
  },

  orders: {
    // GET /api/orders
    async list() {
      return load().orders;
    },
    // GET /api/orders/:id — also the polling target for live updates (see API_CONTRACT.md §4)
    async get(id) {
      return load().orders.find((o) => o.id === id) || null;
    },
    // POST /api/orders — mock generates id + ref client-side; the real backend must own both
    async create({ buyerName } = {}) {
      const data = load();
      const order = {
        id: `PP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`,
        ref: `MNFY-${Math.floor(10000000 + Math.random() * 89999999)}`,
        buyer: buyerName?.trim() || BUYER.name,
        item: data.product.name,
        amount: data.product.price,
        state: "Pending Payment",
        flagged: false,
        timestamps: { "Pending Payment": new Date().toISOString() },
      };
      data.orders = [order, ...data.orders];
      persist(data);
      return { order, orders: data.orders };
    },
    // POST /api/orders/:id/ship (seller)
    async markShipped(id) {
      return api.orders._advance(id, "Shipped");
    },
    // POST /api/orders/:id/confirm-delivery (buyer) — settlement to "Completed" is backend-driven
    async confirmDelivery(id) {
      return api.orders._advance(id, "Delivered");
    },
    // Mock-only: stands in for transitions the real backend drives itself
    // (Monnify webhook → "Paid" → "Awaiting Shipment"; settlement → "Completed").
    async _advance(id, state) {
      const data = load();
      data.orders = data.orders.map((o) => (o.id === id ? withState(o, state) : o));
      persist(data);
      return { order: data.orders.find((o) => o.id === id) || null, orders: data.orders };
    },
  },

  assistant: {
    // POST /api/orders/:id/assistant — mock answers locally from the order record (lib/assistant.js)
    async ask(orderId, question) {
      const order = await api.orders.get(orderId);
      return { answer: order ? answerFor(order, question) : "That order isn’t in the record." };
    },
  },

  // Demo-only helper, not a route: clear local data, back to seeds.
  async reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return { orders: SEED_ORDERS, product: SEED_PRODUCT };
  },
};
