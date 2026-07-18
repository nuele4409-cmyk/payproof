"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Amount from "@/components/Amount";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import Seal from "@/components/Seal";
import Timeline from "@/components/Timeline";
import { useDemo } from "@/lib/store";
import { formatAccount, formatTime, stateIndex } from "@/lib/orders";

// The demo's centerpiece: the payment confirmation arrives from the backend,
// unprompted by anything on this page — no refresh button, no polling UI.
export default function PayPage() {
  const { orderId } = useParams();
  const { ready, orders, seller, advance, showToast } = useDemo();
  const order = orders.find((o) => o.id === orderId);

  // Remember whether this visit began at Pending Payment, so the stamp
  // animation only plays when the confirmation actually lands live.
  const sawPending = useRef(false);
  if (order?.state === "Pending Payment") sawPending.current = true;

  // Demo stand-in for the Monnify confirmation (the real app gets this
  // pushed from the backend when the transfer lands).
  useEffect(() => {
    if (!ready || !order || order.state !== "Pending Payment") return;
    const t = setTimeout(() => advance(order.id, "Paid"), 6500);
    return () => clearTimeout(t);
  }, [ready, order?.state, order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shortly after the stamp, the order moves on to Awaiting Shipment.
  useEffect(() => {
    if (!ready || !order || order.state !== "Paid") return;
    const t = setTimeout(() => advance(order.id, "Awaiting Shipment"), 3200);
    return () => clearTimeout(t);
  }, [ready, order?.state, order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(seller.account.number);
      showToast("Account number copied");
    } catch {
      showToast(`Account number: ${seller.account.number}`);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-ink/45">Opening the record…</p>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[540px] flex-1 flex-col items-center justify-center px-4 text-center">
          <h1 className="display-l">Order not found</h1>
          <p className="mt-3 text-ink/60">
            It may have been cleared by a demo reset. Start a new order from the storefront.
          </p>
          <Button href="/p/aj1-low" className="mt-6">
            Back to the storefront
          </Button>
        </main>
        <AppFooter />
      </div>
    );
  }

  const paid = stateIndex(order.state) >= 1;
  const animate = sawPending.current && paid;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-8 sm:py-12">
        {!paid ? (
          <>
            <p className="caption text-brass">Pay by bank transfer</p>
            <h1 className="mt-3 flex items-baseline gap-3">
              <Amount className="display-xl" value={order.amount} />
              <span className="caption text-ink/45">{order.id}</span>
            </h1>

            <section className="mt-6 rounded-card border border-ink/12 bg-paper p-5">
              <dl className="space-y-4">
                <div>
                  <dt className="caption text-ink/45">Bank</dt>
                  <dd className="mt-0.5 font-medium">{seller.account.bank}</dd>
                </div>
                <div>
                  <dt className="caption text-ink/45">Account number</dt>
                  <dd className="mt-0.5 flex items-center gap-2.5">
                    <span className="data text-[24px]">{formatAccount(seller.account.number)}</span>
                    <button
                      onClick={copy}
                      aria-label="Copy account number"
                      className="rounded-control p-1.5 text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
                    >
                      <Icon name="copy" size={16} />
                    </button>
                  </dd>
                </div>
                <div>
                  <dt className="caption text-ink/45">Account name</dt>
                  <dd className="mt-0.5 font-medium">{seller.account.name}</dd>
                </div>
              </dl>
              <p className="mt-5 border-t border-ink/12 pt-4 text-[13px] text-ink/55">
                Transfer the exact amount from any bank app. No screenshots needed — confirmation
                comes from the bank.
              </p>
            </section>

            <div className="mt-6 flex items-center gap-2.5">
              <span className="waiting-dot h-2 w-2 shrink-0 rounded-full bg-bottle" />
              <p className="text-sm text-ink/65">
                Waiting for the bank to confirm your transfer — this page updates by itself.
              </p>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="flex justify-center">
              <Seal size={280} stamping={animate}>
                <span className="caption text-ink/55">Payment</span>
                <span className="font-display text-[44px] font-semibold leading-none text-brass">
                  PAID
                </span>
                <span className="data mt-2 text-[13px] text-ink/60">{order.ref}</span>
                {order.timestamps["Paid"] && (
                  <span className="caption mt-1 text-ink/45">
                    {formatTime(order.timestamps["Paid"])}
                  </span>
                )}
              </Seal>
            </div>
            <div className={animate ? "rise-in-delayed" : ""}>
              <h1 className="display-l mt-8">Payment confirmed.</h1>
              <p className="mx-auto mt-3 max-w-[40ch] leading-relaxed text-ink/70">
                <Amount value={order.amount} /> is now held by Monnify. Ada has been asked to ship —
                nothing releases to her until you confirm delivery.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button href={`/orders/${order.id}`}>
                  View order timeline
                  <Icon name="arrow-right" size={16} />
                </Button>
                <Button href="/p/aj1-low" variant="secondary">
                  Back to the storefront
                </Button>
              </div>
            </div>
          </div>
        )}

        <section className="mt-12 border-t border-ink/12 pt-8">
          <p className="caption mb-6 text-ink/45">Transaction record</p>
          <Timeline order={order} stampedPaid={animate} />
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
