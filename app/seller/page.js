"use client";

import AppHeader, { AppFooter } from "@/components/AppHeader";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import LedgerTable from "@/components/LedgerTable";
import Seal, { Hallmark } from "@/components/Seal";
import { useDemo } from "@/lib/store";
import { formatAccount } from "@/lib/orders";

export default function SellerDashboard() {
  const { ready, orders, seller, markShipped, showToast } = useDemo();

  const ship = (order) => {
    markShipped(order.id);
    showToast("Marked as shipped");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(seller.account.number);
      showToast("Account number copied");
    } catch {
      showToast(`Account number: ${seller.account.number}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="display-l">Ada’s ledger</h1>
          <div className="flex gap-2.5">
            <Button href="/seller/product" variant="secondary" size="sm">
              Edit listing
            </Button>
            <Button href="/p/aj1-low" variant="secondary" size="sm">
              View storefront
            </Button>
          </div>
        </div>

        {/* the reserved account — always visible, never buried in settings */}
        <section className="mt-6 grid gap-4 rounded-card border border-ink/12 bg-paper p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6">
          <div className="hidden sm:block">
            <Seal size={96}>
              <Icon name="check" size={26} strokeWidth={2.5} className="text-brass" />
            </Seal>
          </div>
          <div>
            <p className="caption text-ink/45">
              Reserved account · {seller.account.bank}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <span className="data text-[21px]">{formatAccount(seller.account.number)}</span>
              <button
                onClick={copy}
                aria-label="Copy account number"
                className="rounded-control p-1.5 text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <Icon name="copy" size={16} />
              </button>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink/55">
              {seller.account.name} <Hallmark size={14} />
              <span className="caption text-ink/45">Verified by Monnify</span>
            </p>
          </div>
          <div className="border-t border-ink/12 pt-4 sm:max-w-[240px] sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <p className="caption text-ink/45">Settlement account</p>
            <p className="mt-1 flex items-center gap-1.5">
              <Icon name="lock" size={14} className="text-ink/50" />
              <span className="data">{seller.settlement.bank} {seller.settlement.masked}</span>
            </p>
            <p className="mt-1 text-[13px] leading-snug text-ink/55">
              Locked to {seller.settlement.name}. Funds settle after delivery is confirmed.
            </p>
          </div>
        </section>

        {/* the ledger itself */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="heading">Orders</h2>
            {ready && (
              <span className="caption text-ink/45">
                {orders.length} {orders.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
          <div className="mt-4">
            {!ready ? (
              <p className="py-10 text-center text-sm text-ink/45">Opening the ledger…</p>
            ) : orders.length === 0 ? (
              <div className="rounded-card border border-ink/12 bg-paper p-8 text-center">
                <p className="text-ink/70">
                  No orders yet — share your storefront on WhatsApp to make your first verified sale.
                </p>
                <Button href="/p/aj1-low" variant="secondary" className="mt-4">
                  <Icon name="link" size={15} />
                  Open your storefront
                </Button>
              </div>
            ) : (
              <LedgerTable orders={orders} onShip={ship} />
            )}
          </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
