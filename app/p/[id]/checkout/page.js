"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Amount from "@/components/Amount";
import Button from "@/components/Button";
import { Field } from "@/components/Field";
import ProductImage from "@/components/ProductImage";
import { Hallmark } from "@/components/Seal";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api";

export default function Checkout() {
  const router = useRouter();
  const { id } = useParams();
  const { ready, user, createOrder } = useDemo();
  const [product, setProduct] = useState(null);
  const [productStatus, setProductStatus] = useState("loading");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Prefill from the signed-in user's name once hydration finishes.
  useEffect(() => {
    if (user?.name && !name) setName(user.name);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auth gate: /api/orders/[id]/confirm-delivery requires a token, and every
  // real order should attach to a real buyer account. Bounce unsigned-in
  // visitors to /login with a redirect back here.
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const back = `/p/${id}/checkout`;
      router.replace(`/login?redirect=${encodeURIComponent(back)}`);
    }
  }, [ready, user, id, router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await api.products.get(id);
        if (!alive) return;
        if (!p) { setProductStatus("notfound"); return; }
        setProduct(p);
        setProductStatus("ready");
      } catch {
        if (alive) setProductStatus("notfound");
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const sellerFirst = (product?.seller?.name ?? "the seller").split(" ")[0];

  const pay = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name for the order.");
      return;
    }
    setBusy(true);
    try {
      const order = await createOrder({ buyerName: name.trim(), productSlug: id });
      router.push(`/pay/${order.id}`);
    } catch (err) {
      setError(err.message || "Could not start checkout.");
      setBusy(false);
    }
  };

  if (!ready || !user || productStatus === "loading") {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-ink/45">Preparing your checkout…</p>
        </main>
      </div>
    );
  }

  if (productStatus === "notfound" || !product) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[540px] flex-1 flex-col items-center justify-center px-4 text-center">
          <h1 className="display-l">Listing not found</h1>
          <p className="mt-3 text-ink/60">This listing may have been removed by the seller.</p>
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-[540px] flex-1 px-4 py-8 sm:py-12">
        <h1 className="display-l">Checkout</h1>

        <form onSubmit={pay} className="mt-6 space-y-6">
          <section className="rounded-card border border-ink/12 bg-paper p-5">
            <div className="flex items-center gap-4">
              <ProductImage product={product} className="h-16 w-16 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{product.name}</p>
                <p className="caption mt-0.5 text-ink/45">Qty 1</p>
              </div>
              <Amount className="data" value={product.price} />
            </div>

            <div className="mt-5 space-y-4 border-t border-ink/12 pt-5">
              <Field
                label="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <Field
                label="Phone (for delivery updates)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0803 123 4567"
                autoComplete="tel"
              />
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t border-ink/12 pt-5">
              <span className="caption text-ink/45">Total due</span>
              <Amount className="display-xl" value={product.price} />
            </div>
          </section>

          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink/70">
            <Hallmark size={17} className="mt-0.5 shrink-0" />
            Your payment is held until you confirm delivery. {sellerFirst} is only paid after you
            do.
          </p>

          {error && <p role="alert" className="text-sm text-rust">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Starting your order…" : (
              <>Pay <Amount value={product.price} /> by bank transfer</>
            )}
          </Button>
          <p className="caption text-center text-ink/45">
            You'll get a dedicated account number on the next screen
          </p>
        </form>
      </main>
      <AppFooter />
    </div>
  );
}
