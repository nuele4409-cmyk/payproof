// PayProof API client — the single surface every component talks through.
// One function per backend route documented in API_CONTRACT.md.

import { answerFor } from "./assistant";

const TOKEN_KEY = "payproof-token";
const USER_KEY  = "payproof-user";

// Empty placeholders used only as initial state for pages that render
// before their real data has loaded from the backend. Nothing about the
// prior demo defaults survives.
export const BUYER = { name: "" };

export const SELLER = {
  name: "",
  store: "",
  verified: false,
  account: { bank: "", number: "", name: "" },
  settlement: { bank: "", masked: "", name: "" },
  typicalOrder: null,
};

export const SEED_PRODUCT = {
  id: "",
  name: "",
  price: 0,
  description: "",
  image: null,
};

// ——— token storage (localStorage, browser-only) ———

export const tokenStore = {
  get() {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    if (typeof window === "undefined") return;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else       localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
  getUser() {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  setUser(user) {
    if (typeof window === "undefined") return;
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else      localStorage.removeItem(USER_KEY);
    } catch {}
  },
  clear() {
    this.set(null);
    this.setUser(null);
  },
};

// ——— fetch wrapper ———

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code   = code;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { /* non-JSON body */ }
  }

  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new ApiError(res.status, data?.code, msg);
  }
  return data;
}

// ——— seller shape adapter ———
// Backend GET /api/seller/me can return null account/settlement when the
// seller hasn't finished setup. UI expects the shape from `SELLER` above;
// merge to keep components simple.
function shapeSeller(me) {
  return {
    name:     me.name ?? "",
    store:    me.store ?? "",
    verified: !!me.verified,
    account: me.account ?? { bank: "", number: "", name: "" },
    settlement: me.settlement ?? { bank: "", masked: "", name: "" },
    typicalOrder:   me.typicalOrder ?? null,
    storefrontSlug: me.storefrontSlug ?? null,
  };
}

// ——— public api surface ———

export const api = {
  auth: {
    async register({ name, contact, password, role, bvn } = {}) {
      const data = await request("/api/auth/register", {
        method: "POST",
        body:   { name, contact, password, role, bvn },
        auth:   false,
      });
      if (data?.token) {
        tokenStore.set(data.token);
        tokenStore.setUser(data.user);
      }
      return data;
    },
    async login({ contact, password } = {}) {
      const data = await request("/api/auth/login", {
        method: "POST",
        body:   { contact, password },
        auth:   false,
      });
      if (data?.token) {
        tokenStore.set(data.token);
        tokenStore.setUser(data.user);
      }
      return data;
    },
    logout() {
      tokenStore.clear();
    },
    currentUser() {
      return tokenStore.getUser();
    },
  },

  seller: {
    async me() {
      const raw = await request("/api/seller/me");
      return shapeSeller(raw);
    },
    async saveSettlement({ bankCode, accountNumber }) {
      return request("/api/seller/me/settlement", {
        method: "PUT",
        body:   { bankCode, accountNumber },
      });
    },
    // The seller's own view of their single listing. Returns null when the
    // seller hasn't created one yet.
    async getProduct() {
      return request("/api/seller/me/product");
    },
    // Upserts the seller's single listing. Backend generates the slug on
    // first save (store-<userId>) — no slug needed from the caller.
    async saveProduct(product) {
      return request("/api/seller/me/product", {
        method: "PUT",
        body: {
          name:        product.name,
          price:       product.price,
          description: product.description,
          image:       product.image ?? null,
        },
      });
    },
  },

  products: {
    // Public buyer-facing read. Requires a real slug from the URL.
    async get(slug) {
      if (!slug) return null;
      return request(`/api/products/${slug}`, { auth: false });
    },
  },

  orders: {
    async list() {
      return request("/api/orders");
    },
    async get(id) {
      try {
        return await request(`/api/orders/${id}`, { auth: false });
      } catch (err) {
        if (err.status === 404) return null;
        throw err;
      }
    },
    async create({ buyerName, productSlug, sellerContact } = {}) {
      const data = await request("/api/orders", {
        method: "POST",
        body:   { buyerName, productSlug, sellerContact },
        auth:   false,
      });
      return { order: data.order };
    },
    async markShipped(id) {
      const order = await request(`/api/orders/${id}/ship`, { method: "POST" });
      return { order };
    },
    async confirmDelivery(id) {
      const order = await request(`/api/orders/${id}/confirm-delivery`, { method: "POST" });
      return { order };
    },
  },

  payouts: {
    // POST /api/payouts/release/:id — seller-only. Backend enforces an atomic
    // claim on Order.payoutClaimedAt, so a double-click here is safe (the
    // second call returns 409, which we surface as a normal error). The
    // order's Completed state doesn't change; the release is recorded in
    // timestamps.PayoutSent + timestamps.payoutRef.
    async release(id) {
      return request(`/api/payouts/release/${id}`, { method: "POST" });
    },
  },

  assistant: {
    async ask(orderId, question) {
      // Deterministic answers live client-side (lib/assistant.js) — the
      // backend doesn't have an assistant endpoint today. Fetch the order
      // through the real client so the answer reflects live state.
      const order = await api.orders.get(orderId);
      return { answer: order ? answerFor(order, question) : "That order isn’t in the record." };
    },
  },
};

export { ApiError };
