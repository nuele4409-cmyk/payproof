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

const STORAGE_KEY = "payproof-demo-v1";

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

const SEED_PRODUCT = {
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

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [orders, setOrders] = useState(null); // null until hydrated from localStorage
  const [product, setProduct] = useState(SEED_PRODUCT);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setOrders(Array.isArray(data.orders) ? data.orders : SEED_ORDERS);
        if (data.product) setProduct(data.product);
      } else {
        setOrders(SEED_ORDERS);
      }
    } catch {
      setOrders(SEED_ORDERS);
    }
  }, []);

  useEffect(() => {
    if (!orders) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ orders, product }));
    } catch {
      // storage full (large photo) — demo keeps working in memory
    }
  }, [orders, product]);

  const showToast = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const advance = useCallback((id, state) => {
    setOrders((prev) =>
      prev
        ? prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  state,
                  timestamps: { ...o.timestamps, [state]: new Date().toISOString() },
                }
              : o,
          )
        : prev,
    );
  }, []);

  const createOrder = useCallback(
    ({ buyerName } = {}) => {
      const order = {
        id: `PP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`,
        ref: `MNFY-${Math.floor(10000000 + Math.random() * 89999999)}`,
        buyer: buyerName?.trim() || BUYER.name,
        item: product.name,
        amount: product.price,
        state: "Pending Payment",
        flagged: false,
        timestamps: { "Pending Payment": new Date().toISOString() },
      };
      setOrders((prev) => [order, ...(prev || [])]);
      return order;
    },
    [product],
  );

  const confirmDelivery = useCallback(
    (id) => {
      advance(id, "Delivered");
      // settlement happens on its own moments later
      setTimeout(() => advance(id, "Completed"), 2600);
    },
    [advance],
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setOrders(SEED_ORDERS);
    setProduct(SEED_PRODUCT);
    showToast("Demo data reset");
  }, [showToast]);

  const value = useMemo(
    () => ({
      ready: orders !== null,
      orders: orders || [],
      product,
      seller: SELLER,
      buyer: BUYER,
      setProduct,
      createOrder,
      advance,
      confirmDelivery,
      reset,
      showToast,
    }),
    [orders, product, createOrder, advance, confirmDelivery, reset, showToast],
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
