"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Icon from "@/components/Icon";
import { api, BUYER, SELLER, SEED_PRODUCT, tokenStore } from "./api";

// React state layer over lib/api.js. All reads/writes go through the api
// client — this file mirrors results into context, owns the toast, and
// handles the demo's role-based data fetching.

const DemoContext = createContext(null);

// Buyer's "my orders" list is kept client-side because the backend Order
// model doesn't track buyerId today (see API_CONTRACT.md, unresolved list).
// We remember each order the buyer touches (created via checkout, or paid
// on /pay), and hydrate them individually via the public GET /api/orders/:id.
const BUYER_ORDER_IDS_KEY = "payproof-buyer-order-ids";

function readBuyerOrderIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BUYER_ORDER_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function rememberBuyerOrderId(id) {
  if (typeof window === "undefined") return;
  const list = readBuyerOrderIds();
  if (!list.includes(id)) {
    try {
      localStorage.setItem(BUYER_ORDER_IDS_KEY, JSON.stringify([id, ...list]));
    } catch {}
  }
}

export function DemoProvider({ children }) {
  const [user, setUser]       = useState(null); // { name, role } or null
  const [orders, setOrders]   = useState(null); // null until hydrated
  const [product, setProduct] = useState(SEED_PRODUCT);
  const [seller, setSeller]   = useState(SELLER); // display data for the current or product's seller
  const [toast, setToast]     = useState(null);
  const toastTimer = useRef(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const showToast = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // Hydrate: figure out who this session is (localStorage token) and fetch
  // the right data for that role. Runs on mount and after login/logout via
  // refreshTick.
  useEffect(() => {
    let alive = true;
    (async () => {
      const currentUser = tokenStore.getUser();
      if (alive) setUser(currentUser);

      // Product is public and always needed.
      try {
        const prod = await api.products.get();
        if (!alive) return;
        setProduct(prod);
        if (prod?.seller) {
          setSeller((s) => ({
            ...s,
            name: prod.seller.name,
            store: prod.seller.store,
            verified: prod.seller.verified,
          }));
        }
      } catch {}

      if (currentUser?.role === "seller") {
        try {
          const [me, list] = await Promise.all([
            api.seller.me(),
            api.orders.list(),
          ]);
          if (!alive) return;
          setSeller(me);
          setOrders(list);
        } catch {
          if (alive) setOrders([]);
        }
      } else if (currentUser?.role === "buyer") {
        const ids = readBuyerOrderIds();
        try {
          const fetched = await Promise.all(ids.map((id) => api.orders.get(id).catch(() => null)));
          if (!alive) return;
          setOrders(fetched.filter(Boolean));
        } catch {
          if (alive) setOrders([]);
        }
      } else {
        // Not signed in — no orders to show. Pages that need them redirect
        // to /login themselves.
        if (alive) setOrders([]);
      }
    })();
    return () => { alive = false; };
  }, [refreshTick]);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const login = useCallback(async ({ contact, password }) => {
    const data = await api.auth.login({ contact, password });
    setUser(data.user);
    refresh();
    return data;
  }, [refresh]);

  const register = useCallback(async ({ name, contact, password, role, bvn }) => {
    const data = await api.auth.register({ name, contact, password, role, bvn });
    setUser(data.user);
    refresh();
    return data;
  }, [refresh]);

  const logout = useCallback(() => {
    api.auth.logout();
    setUser(null);
    setOrders(null);
    setSeller(SELLER);
    refresh();
  }, [refresh]);

  // Pushes the freshest copy of one order into local state (used by pay
  // page polling and by buttons that mutate an order).
  const upsertOrder = useCallback((order) => {
    if (!order) return;
    setOrders((prev) => {
      const list = prev ?? [];
      const idx  = list.findIndex((o) => o.id === order.id);
      if (idx === -1) return [order, ...list];
      const next = list.slice();
      next[idx]  = order;
      return next;
    });
  }, []);

  const markShipped = useCallback(async (id) => {
    const { order } = await api.orders.markShipped(id);
    upsertOrder(order);
    return order;
  }, [upsertOrder]);

  const createOrder = useCallback(async ({ buyerName } = {}) => {
    const { order } = await api.orders.create({ buyerName });
    rememberBuyerOrderId(order.id);
    upsertOrder(order);
    return order;
  }, [upsertOrder]);

  const confirmDelivery = useCallback(async (id) => {
    // Backend advances Shipped → Delivered → Completed in one transaction
    // (see app/api/orders/[id]/confirm-delivery/route.js), so the returned
    // order is already Completed.
    const { order } = await api.orders.confirmDelivery(id);
    upsertOrder(order);
    return order;
  }, [upsertOrder]);

  const saveProduct = useCallback(async (p) => {
    const saved = await api.products.save(p);
    setProduct(saved);
  }, []);

  // Called by the pay page's polling and the order-detail page: refetch a
  // single order and merge into local state.
  const refreshOrder = useCallback(async (id) => {
    const order = await api.orders.get(id);
    if (order) upsertOrder(order);
    return order;
  }, [upsertOrder]);

  const saveSettlement = useCallback(async ({ bankCode, accountNumber }) => {
    const settlement = await api.seller.saveSettlement({ bankCode, accountNumber });
    setSeller((s) => ({ ...s, settlement }));
    return settlement;
  }, []);

  const value = useMemo(
    () => ({
      ready: orders !== null,
      user,
      orders: orders || [],
      product,
      seller,
      buyer: user?.role === "buyer" ? { name: user.name } : BUYER,
      login,
      register,
      logout,
      saveProduct,
      saveSettlement,
      createOrder,
      markShipped,
      confirmDelivery,
      refreshOrder,
      showToast,
    }),
    [
      orders, user, product, seller,
      login, register, logout,
      saveProduct, saveSettlement, createOrder, markShipped, confirmDelivery, refreshOrder,
      showToast,
    ],
  );

  return (
    <DemoContext.Provider value={value}>
      {children}
      {toast && (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          className="toast-in fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-control bg-ink px-4 py-2.5 text-sm font-medium text-parchment"
        >
          <Icon name="check" size={15} className="text-brass-light" />
          {toast.text}
        </div>
      )}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}
