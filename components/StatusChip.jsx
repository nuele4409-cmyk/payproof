// The one place pill radius is allowed: order-status chips.
const STYLES = {
  "Pending Payment": { chip: "bg-ink/5 text-ink/60", dot: "border border-ink/40" },
  Paid: { chip: "bg-bottle/10 text-bottle", dot: "bg-bottle" },
  "Awaiting Shipment": { chip: "bg-bottle/10 text-bottle", dot: "bg-bottle" },
  Shipped: { chip: "border border-bottle/30 text-bottle", dot: "bg-bottle" },
  Delivered: { chip: "bg-bottle/15 text-bottle-dark", dot: "bg-bottle-dark" },
  Completed: { chip: "bg-bottle text-paper", dot: "bg-paper" },
  Flagged: { chip: "bg-rust/10 text-rust", dot: "bg-rust" },
};

export default function StatusChip({ state, className = "" }) {
  const s = STYLES[state] || STYLES["Pending Payment"];
  return (
    <span
      className={`caption inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px] ${s.chip} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
      {state}
    </span>
  );
}
