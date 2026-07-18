"use client";

import { useParams } from "next/navigation";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Amount from "@/components/Amount";
import AssistantPanel from "@/components/AssistantPanel";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import StatusChip from "@/components/StatusChip";
import Timeline from "@/components/Timeline";
import { useDemo } from "@/lib/store";
import { formatDateTime } from "@/lib/orders";

export default function OrderDetail() {
  const { id } = useParams();
  const { ready, orders, seller, confirmDelivery, showToast } = useDemo();
  const order = orders.find((o) => o.id === id);

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
          <p className="mt-3 text-ink/60">It may have been cleared by a demo reset.</p>
          <Button href="/buyer" className="mt-6">
            Back to your orders
          </Button>
        </main>
        <AppFooter />
      </div>
    );
  }

  const confirm = () => {
    confirmDelivery(order.id);
    showToast("Delivery confirmed");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-baseline gap-3">
            <span className="display-l">Order</span>
            <span className="data text-[17px] text-ink/60">{order.id}</span>
          </h1>
          <StatusChip state={order.state} />
        </div>
        <p className="mt-2 text-sm text-ink/60">
          {order.item} · <Amount className="data text-[13px]" value={order.amount} /> · {order.buyer}
        </p>

        {order.flagged && (
          <section className="mt-6 rounded-card border border-rust/25 bg-rust/5 p-4">
            <p className="flex items-center gap-2 font-medium text-rust">
              <Icon name="flag" size={15} />
              Flagged — amount is unusually high for this seller
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
              {order.flagReason} This is a simple rule, not a judgment — confirm with the buyer
              before shipping.
            </p>
          </section>
        )}

        {/* the transaction timeline — front and center */}
        <section className="mt-6 rounded-card border border-ink/12 bg-paper p-5 sm:p-7">
          <p className="caption mb-6 text-ink/45">Transaction record</p>
          <Timeline order={order} />

          {order.state === "Shipped" && (
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-ink/12 pt-5">
              <p className="text-sm leading-relaxed text-ink/70">
                Has it arrived? Confirming releases{" "}
                <Amount className="data text-[13px]" value={order.amount} /> to{" "}
                {seller.name.split(" ")[0]}.
              </p>
              <Button onClick={confirm}>Confirm Delivery</Button>
            </div>
          )}
          {order.state === "Delivered" && (
            <p className="mt-7 flex items-center gap-2.5 border-t border-ink/12 pt-5 text-sm text-ink/70">
              <span className="waiting-dot h-2 w-2 shrink-0 rounded-full bg-bottle" />
              Delivery confirmed — settlement to {seller.settlement.bank}{" "}
              {seller.settlement.masked} is finishing up.
            </p>
          )}
          {order.state === "Completed" && (
            <p className="mt-7 flex items-center gap-2 border-t border-ink/12 pt-5 text-sm text-ink/70">
              <Icon name="check" size={15} className="shrink-0 text-bottle" />
              Funds released to {seller.settlement.bank} {seller.settlement.masked} — settlement
              complete.
            </p>
          )}
        </section>

        {/* payment record */}
        {order.timestamps["Paid"] && (
          <section className="mt-5 rounded-card border border-ink/12 bg-paper p-5">
            <p className="caption text-ink/45">Payment confirmation</p>
            <dl className="mt-3 grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink/55">Reference</dt>
                <dd className="data text-[13px]">{order.ref}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink/55">Amount</dt>
                <dd>
                  <Amount className="data text-[13px]" value={order.amount} />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink/55">Method</dt>
                <dd>Transfer · {seller.account.bank}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink/55">Confirmed</dt>
                <dd className="data text-[13px]">{formatDateTime(order.timestamps["Paid"])}</dd>
              </div>
            </dl>
          </section>
        )}

        {/* order-scoped assistant — inline, not a floating bubble */}
        <div className="mt-5">
          <AssistantPanel order={order} />
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
