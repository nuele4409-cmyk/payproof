"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Amount from "@/components/Amount";
import Button from "@/components/Button";
import { Field } from "@/components/Field";
import ProductImage from "@/components/ProductImage";
import { Hallmark } from "@/components/Seal";
import { useDemo } from "@/lib/store";
import { api, tokenStore } from "@/lib/api";

// Kept in sync with prisma/seed.js — an anonymous buyer at checkout gets
// silently logged in as the demo buyer so they can confirm delivery later
// (my earlier fix requires auth on that endpoint). Not the shape a real
// buyer flow would take — see API_CONTRACT.md, unresolved list.
const DEMO_BUYER = { contact: "tobi@payproof.demo", password: "payproof-demo" };

export default function Checkout() {
  const router = useRouter();
  const { product, createOrder, buyer, seller } = useDemo();
  const sellerFirst = (seller.name || product?.seller?.name || "the seller").split(" ")[0];
  const [name, setName] = useState(buyer.name);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pay = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!tokenStore.get()) {
        // Silent demo login so this buyer can hit /confirm-delivery later.
        await api.auth.login(DEMO_BUYER);
      }
      const order = await createOrder({ buyerName: name });
      router.push(`/pay/${order.id}`);
    } catch (err) {
      setError(err.message || "Could not start checkout.");
      setBusy(false);
    }
  };

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
            You’ll get a dedicated account number on the next screen
          </p>
        </form>
      </main>
      <AppFooter />
    </div>
  );
}
