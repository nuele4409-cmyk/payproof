import { formatNumber } from "@/lib/orders";

// Naira amounts everywhere — the ₦ sign always renders in Plex (see .naira),
// so it survives Fraunces display sizes that lack the glyph.
export default function Amount({ value, className = "" }) {
  return (
    <span className={`lining ${className}`}>
      <span className="naira">₦</span>
      {formatNumber(value)}
    </span>
  );
}
