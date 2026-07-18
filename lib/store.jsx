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
import { api, BUYER, SELLER, SEED_PRODUCT } from "./api";

// React state layer over lib/api.js. All reads/writes go through the api
// client — this file only mirrors results into context and owns the toast.

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [orders, setOrders] = useState(null); // null until hydrated
  const [product, setProduct] = useState(SEED_PRODUCT);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [list, prod] = await Promise.all([api.orders.list(), api.products.get()]);
      if (!alive) return;
      setOrders(list);
      setProduct(prod);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const showToast = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // Mock-only: drives the transitions the real backend will own (see API_CONTRACT.md §4).
  const advance = useCallback(async (id, state) => {
    const { orders: next } = await api.orders._advance(id, state);
    setOrders(next);
  }, []);

  const markShipped = useCallback(async (id) => {
    const { orders: next } = await api.orders.markShipped(id);
    setOrders(next);
  }, []);

  const createOrder = useCallback(async ({ buyerName } = {}) => {
    const { order, orders: next } = await api.orders.create({ buyerName });
    setOrders(next);
    return order;
  }, []);

  const confirmDelivery = useCallback(
    async (id) => {
      const { orders: next } = await api.orders.confirmDelivery(id);
      setOrders(next);
      // demo stand-in for the settlement confirmation the backend will push
      setTimeout(async () => {
        const { orders: after } = await api.orders._advance(id, "Completed");
        setOrders(after);
      }, 2600);
    },
    [],
  );

  const saveProduct = useCallback(async (p) => {
    const saved = await api.products.save(p);
    setProduct(saved);
  }, []);

  const reset = useCallback(async () => {
    const seeds = await api.reset();
    setOrders(seeds.orders);
    setProduct(seeds.product);
    showToast("Demo data reset");
  }, [showToast]);

  const value = useMemo(
    () => ({
      ready: orders !== null,
      orders: orders || [],
      product,
      seller: SELLER,
      buyer: BUYER,
      saveProduct,
      createOrder,
      advance,
      markShipped,
      confirmDelivery,
      reset,
      showToast,
    }),
    [orders, product, saveProduct, createOrder, advance, markShipped, confirmDelivery, reset, showToast],
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
