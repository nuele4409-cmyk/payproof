"use client";

import Link from "next/link";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Amount from "@/components/Amount";
import Button from "@/components/Button";
import { Hallmark } from "@/components/Seal";
import StatusChip from "@/components/StatusChip";
import { useDemo } from "@/lib/store";
import { useState } from "react";

export default function BuyerDashboard() {
  const { ready, orders, confirmDelivery, showToast } = useDemo();
  const [confirming, setConfirming] = useState(null);
  // The store already scopes `orders` to this buyer's touched order-IDs
  // (see BUYER_ORDER_IDS_KEY in lib/store.jsx), so no client-side filter here.
  const mine = orders;

  const confirm = async (order) => {
    setConfirming(order.id);
    try {
      await confirmDelivery(order.id);
      showToast("Delivery confirmed");
    } catch (e) {
      showToast(e.message || "Could not confirm delivery");
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="display-l">Your orders</h1>
        <p className="mt-2 text-ink/60">
          Payments are held by Monnify until you confirm delivery.
        </p>

        <div className="mt-7 space-y-3.5">
          {!ready ? (
            <p className="py-10 text-center text-sm text-ink/45">Opening your orders…</p>
          ) : mine.length === 0 ? (
            <div className="rounded-card border border-ink/12 bg-paper p-8 text-center">
              <p className="text-ink/70">
                No purchases yet — orders you pay for through PayProof appear here with their full
                payment record.
              </p>
            </div>
          ) : (
            mine.map((o) => (
              <div key={o.id} className="rounded-card border border-ink/12 bg-paper p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{o.item}</span>
                  <StatusChip state={o.state} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[13px] text-ink/55">
                    {o.seller?.store ?? "Seller"} <Hallmark size={13} />
                    <span className="data text-[12px] text-ink/45">{o.id}</span>
                  </span>
                  <Amount className="data" value={o.amount} />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/12 pt-3.5">
                  <Link
                    href={`/orders/${o.id}`}
                    className="text-sm font-medium text-bottle underline-offset-2 hover:underline"
                  >
                    View timeline →
                  </Link>
                  {o.state === "Shipped" && (
                    <Button size="sm" onClick={() => confirm(o)} disabled={confirming === o.id}>
                      Confirm Delivery
                    </Button>
                  )}
                  {o.state === "Pending Payment" && (
                    <Button size="sm" variant="secondary" href={`/pay/${o.id}`}>
                      Complete payment
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
