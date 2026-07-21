"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Amount from "@/components/Amount";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import Seal from "@/components/Seal";
import Timeline from "@/components/Timeline";
import { useDemo } from "@/lib/store";
import { formatAccount, formatTime, stateIndex } from "@/lib/orders";
import { api } from "@/lib/api";

export default function PayPage() {
  const { orderId } = useParams();
  const { showToast } = useDemo();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | notfound
  const [simBusy, setSimBusy] = useState(false);
  const [animate, setAnimate] = useState(false);

  const poll = useCallback(async () => {
    try {
      const o = await api.orders.get(orderId);
      if (!o) { setStatus("notfound"); return; }
      if (o.state === "Pending Payment") sawPending.current = true;
      setOrder(o);
      setStatus("ready");
    } catch {
      // transient — next poll will retry
    }
  }, [orderId]);

  useEffect(() => {
    let alive = true;
    let timer = null;

    const tick = async () => {
      const o = await api.orders.get(orderId);
      if (!alive) return;
      if (!o) { setStatus("notfound"); return; }
      setOrder((prev) => {
        if (prev?.state === "Pending Payment" && o.state !== "Pending Payment") {
          setAnimate(true);
        }
        return o;
      });
      setStatus("ready");
      if (o.state === "Pending Payment") {
        timer = setTimeout(tick, 3000);
      }
    };

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const simulate = async () => {
    setSimBusy(true);
    try {
      const res = await fetch("/api/monnify/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Payment simulated — refreshing");
      await poll();
    } catch (e) {
      showToast(e.message || "Simulation failed");
    } finally {
      setSimBusy(false);
    }
  };

  const copy = async () => {
    if (!order?.seller?.account?.number) return;
    try {
      await navigator.clipboard.writeText(order.seller.account.number);
      showToast("Account number copied");
    } catch {
      showToast(`Account number: ${order.seller.account.number}`);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-ink/45">Opening the record…</p>
        </main>
      </div>
    );
  }

  if (status === "notfound" || !order) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[540px] flex-1 flex-col items-center justify-center px-4 text-center">
          <h1 className="display-l">Order not found</h1>
          <p className="mt-3 text-ink/60">
            The link may be wrong or the order may have been cleared.
          </p>
        </main>
        <AppFooter />
      </div>
    );
  }

  const paid = stateIndex(order.state) >= 1;
  const account = order.seller?.account;

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
              {account ? (
                <dl className="space-y-4">
                  <div>
                    <dt className="caption text-ink/45">Bank</dt>
                    <dd className="mt-0.5 font-medium">{account.bank}</dd>
                  </div>
                  <div>
                    <dt className="caption text-ink/45">Account number</dt>
                    <dd className="mt-0.5 flex items-center gap-2.5">
                      <span className="data text-[24px]">{formatAccount(account.number)}</span>
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
                    <dd className="mt-0.5 font-medium">{account.name}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-ink/60">
                  This seller hasn’t finished setting up their reserved account yet.
                </p>
              )}
              <p className="mt-5 border-t border-ink/12 pt-4 text-[13px] text-ink/55">
                Transfer the exact amount from any bank app. No screenshots needed — confirmation
                comes from the bank.
              </p>
            </section>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="waiting-dot h-2 w-2 shrink-0 rounded-full bg-bottle" />
              <p className="text-sm text-ink/65">
                Waiting for the bank to confirm your transfer
              </p>
              <button
                onClick={poll}
                className="ml-auto flex items-center gap-1 rounded-control px-2.5 py-1 text-[13px] font-medium text-bottle transition-colors hover:bg-bottle/5"
              >
                <Icon name="refresh" size={13} />
                Check payment
              </button>
            </div>
            <div className="mt-3 rounded-card bg-parchment/50 px-4 py-2.5 text-[13px] text-ink/50">
              For testing in sandbox, use the Monnify Bank Simulator or click{" "}
              <button
                onClick={simulate}
                disabled={simBusy}
                className="font-medium text-bottle underline-offset-2 hover:underline"
              >
                simulate payment
              </button>
              {simBusy && "…"}
              .
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
                <Amount value={order.amount} /> is now held by Monnify.{" "}
                {order.seller?.name?.split(" ")[0] ?? "The seller"} has been asked to ship —
                nothing releases until you confirm delivery.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button href={`/orders/${order.id}`}>
                  View order timeline
                  <Icon name="arrow-right" size={16} />
                </Button>
                {order.seller?.storefrontSlug && (
                  <Button href={`/p/${order.seller.storefrontSlug}`} variant="secondary">
                    Back to the storefront
                  </Button>
                )}
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
