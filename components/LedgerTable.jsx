"use client";

import Link from "next/link";
import Amount from "./Amount";
import Button from "./Button";
import Icon from "./Icon";
import StatusChip from "./StatusChip";

// Completed orders live in two sub-states from the seller's point of view:
// released (timestamps.PayoutSent stamped by the release endpoint) and not
// yet released. The state string doesn't split these — check the stamp.
function paidOut(order) {
  return !!order.timestamps?.PayoutSent;
}

function RowAction({ order, onShip, onRelease, releasing }) {
  if (order.state === "Awaiting Shipment") {
    return (
      <Button size="sm" onClick={() => onShip(order)}>
        Mark as Shipped
      </Button>
    );
  }
  if (order.state === "Pending Payment") return <span className="caption text-ink/45">Awaiting transfer</span>;
  if (order.state === "Shipped") return <span className="caption text-ink/45">With courier</span>;
  if (order.state === "Delivered") return <span className="caption text-ink/45">Settling…</span>;
  if (order.state === "Completed") {
    if (paidOut(order)) {
      return <span className="caption text-bottle inline-flex items-center gap-1"><Icon name="check" size={12} /> Paid out</span>;
    }
    if (onRelease) {
      return (
        <Button size="sm" onClick={() => onRelease(order)} disabled={releasing}>
          {releasing ? "Releasing…" : "Release payout"}
        </Button>
      );
    }
    return <span className="caption text-bottle">Settled</span>;
  }
  return null;
}

function Ref({ order }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {order.flagged && <Icon name="flag" size={13} className="shrink-0 text-rust" />}
      <Link href={`/orders/${order.id}`} className="data text-bottle underline-offset-2 hover:underline">
        {order.id}
      </Link>
    </span>
  );
}

export default function LedgerTable({ orders, onShip, onRelease, releasingIds }) {
  const isReleasing = (id) => releasingIds?.has(id);

  return (
    <>
      {/* ledger table — hairlines rule off the rows, like a real ledger */}
      <table className="hidden w-full md:table">
        <thead>
          <tr className="border-b border-ink/12">
            {["Ref", "Item", "Buyer", "Amount", "Status", ""].map((h, i) => (
              <th
                key={i}
                className={`caption pb-2.5 font-medium text-ink/45 ${h === "Amount" ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-ink/12">
              <td className="py-3.5 pr-3">
                <Ref order={o} />
              </td>
              <td className="max-w-[220px] truncate py-3.5 pr-3 text-sm text-ink/70">{o.item}</td>
              <td className="py-3.5 pr-3 text-sm">{o.buyer}</td>
              <td className="py-3.5 pr-3 text-right">
                <Amount className="data" value={o.amount} />
              </td>
              <td className="py-3.5 pr-3">
                <StatusChip state={o.state} />
              </td>
              <td className="py-3.5 text-right">
                <RowAction order={o} onShip={onShip} onRelease={onRelease} releasing={isReleasing(o.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* the same ledger as cards on small screens */}
      <div className="space-y-3 md:hidden">
        {orders.map((o) => (
          <div key={o.id} className="rounded-card border border-ink/12 bg-paper p-4">
            <div className="flex items-center justify-between gap-2">
              <Ref order={o} />
              <StatusChip state={o.state} />
            </div>
            <div className="mt-2 text-sm text-ink/80">{o.item}</div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[13px] text-ink/55">{o.buyer}</span>
              <Amount className="data" value={o.amount} />
            </div>
            {o.flagged && (
              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-rust">
                <Icon name="flag" size={13} /> Flagged — review before shipping
              </div>
            )}
            <div className="mt-3">
              {o.state === "Awaiting Shipment" ? (
                <Button size="sm" className="w-full" onClick={() => onShip(o)}>
                  Mark as Shipped
                </Button>
              ) : o.state === "Completed" && !paidOut(o) && onRelease ? (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => onRelease(o)}
                  disabled={isReleasing(o.id)}
                >
                  {isReleasing(o.id) ? "Releasing…" : "Release payout"}
                </Button>
              ) : (
                <RowAction order={o} onShip={onShip} onRelease={onRelease} releasing={isReleasing(o.id)} />
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
