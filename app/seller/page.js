"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Button from "@/components/Button";
import { Field } from "@/components/Field";
import Icon from "@/components/Icon";
import LedgerTable from "@/components/LedgerTable";
import Seal, { Hallmark } from "@/components/Seal";
import { useDemo } from "@/lib/store";
import { formatAccount } from "@/lib/orders";

export default function SellerDashboard() {
  const { ready, user, orders, seller, markShipped, saveSettlement, showToast } = useDemo();
  const router = useRouter();
  const [showSettlementForm, setShowSettlementForm] = useState(false);

  if (user === null && ready) {
    // Not signed in — bounce to /login. Rendered inline instead of routed
    // eagerly so it doesn't fire during hydration.
    router.replace("/login");
  }

  const ship = async (order) => {
    try {
      await markShipped(order.id);
      showToast("Marked as shipped");
    } catch (e) {
      showToast(e.message || "Could not mark as shipped");
    }
  };

  const copy = async () => {
    if (!seller.account?.number) return;
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
          <h1 className="display-l">{seller.name ? `${seller.name.split(" ")[0]}'s ledger` : "Your ledger"}</h1>
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
              {seller.account
                ? `Reserved account · ${seller.account.bank}`
                : "Reserved account not set up yet"}
            </p>
            {seller.account ? (
              <>
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
              </>
            ) : (
              <p className="mt-1 text-[13px] text-ink/55">
                Monnify hasn’t opened your reserved account yet — this can happen if signup
                skipped the BVN. Contact support to finish setup.
              </p>
            )}
          </div>
          <div className="border-t border-ink/12 pt-4 sm:max-w-[280px] sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <p className="caption text-ink/45">Settlement account</p>
            {seller.settlement?.number || seller.settlement?.masked ? (
              <>
                <p className="mt-1 flex items-center gap-1.5">
                  <Icon name="lock" size={14} className="text-ink/50" />
                  <span className="data">{seller.settlement.bank} {seller.settlement.masked}</span>
                </p>
                <p className="mt-1 text-[13px] leading-snug text-ink/55">
                  Locked to {seller.settlement.name}. Funds settle after delivery is confirmed.
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-[13px] text-ink/60">
                  Add the bank account where completed sales should settle.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2.5"
                  onClick={() => setShowSettlementForm(true)}
                >
                  Set settlement account
                </Button>
              </>
            )}
          </div>
        </section>

        {showSettlementForm && (
          <SettlementForm
            onClose={() => setShowSettlementForm(false)}
            onSaved={() => {
              setShowSettlementForm(false);
              showToast("Settlement account saved");
            }}
            saveSettlement={saveSettlement}
          />
        )}

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

function SettlementForm({ onClose, onSaved, saveSettlement }) {
  const [bankCode, setBankCode]           = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError]                 = useState(null);
  const [busy, setBusy]                   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!bankCode.trim() || !accountNumber.trim()) {
      setError("Enter bank code and account number.");
      return;
    }
    setBusy(true);
    try {
      await saveSettlement({ bankCode: bankCode.trim(), accountNumber: accountNumber.trim() });
      onSaved?.();
    } catch (e) {
      setError(e.message || "Could not save settlement account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-card border border-ink/12 bg-paper p-5">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field
          label="Bank code"
          placeholder="e.g. 058 for GTBank"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          inputMode="numeric"
        />
        <Field
          label="Account number"
          placeholder="10 digits"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          inputMode="numeric"
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-rust">{error}</p>}
      <p className="mt-3 text-[13px] text-ink/50">
        Monnify will confirm the account exists before we save it. The account name is taken
        from the bank record.
      </p>
    </section>
  );
}
