// Order-scoped assistant. Deterministic, rule-based answers drawn from the
// order's verified record — no model call, no invented facts.
import { formatDateTime, formatNumber, stateIndex } from "./orders";

const naira = (n) => `₦${formatNumber(n)}`;

function sellerFirstName(order) {
  return order.seller?.name?.split(" ")[0] ?? "the seller";
}

function settlementLabel(order) {
  const s = order.seller?.settlement;
  if (!s?.bank || !s?.masked) return "the seller's settlement account";
  return `${s.bank} ${s.masked}`;
}

export function suggestionsFor(order) {
  const idx = stateIndex(order.state);
  const seller = sellerFirstName(order);
  const s = ["Is this payment verified?"];
  if (idx < 5) s.push(`When does ${seller} get paid?`);
  else s.push("Where did the money go?");
  s.push(idx >= 3 && idx < 5 ? "What happens when I confirm delivery?" : "What if it never ships?");
  return s;
}

export function answerFor(order, question) {
  const q = question.toLowerCase();
  const idx = stateIndex(order.state);
  const paidAt = order.timestamps["Paid"];
  const seller = sellerFirstName(order);
  const settlement = settlementLabel(order);

  if (/(verif|real|fake|screenshot|confirm.*payment|payment.*confirm|paid)/.test(q)) {
    if (idx >= 1) {
      return `Yes — this payment was confirmed by the bank on ${formatDateTime(paidAt)}, reference ${order.ref}. PayProof only marks an order Paid when Monnify reports the transfer, so a screenshot can't change this status.`;
    }
    return `Not yet. No transfer has been confirmed for this order. The status changes to Paid the moment Monnify reports the money — a screenshot can't change it.`;
  }

  if (/(flag|suspicious|risk|fraud|scam(?!.*ship))/.test(q) && order.flagged) {
    return `This order was flagged by a simple rule: ${order.flagReason} It isn't a judgment about the buyer — it just means the amount is far from this seller's usual pattern, so it's worth confirming before shipping.`;
  }

  if (/(money|settle|payout|get paid|paid out|release|funds|account)/.test(q)) {
    if (order.state === "Completed") {
      return `This order settled on ${formatDateTime(order.timestamps["Completed"])}. ${naira(order.amount)} was released to ${seller}'s locked settlement account (${settlement}).`;
    }
    if (idx >= 1) {
      return `${naira(order.amount)} is held by Monnify right now. It settles to ${seller}'s locked account (${settlement}) automatically the moment the buyer confirms delivery — neither side can move it before then.`;
    }
    return `Nothing has been paid yet. Once the transfer is confirmed, ${naira(order.amount)} is held until delivery is confirmed, then settles to ${seller} automatically.`;
  }

  if (/(ship|deliver|track|arriv|where|courier)/.test(q)) {
    if (order.state === "Completed") {
      return `Delivered and confirmed on ${formatDateTime(order.timestamps["Delivered"])}. The order is complete.`;
    }
    if (order.state === "Delivered") {
      return `Delivery was confirmed on ${formatDateTime(order.timestamps["Delivered"])}. Settlement to the seller is finishing up now.`;
    }
    if (order.state === "Shipped") {
      return `${seller} marked this as shipped on ${formatDateTime(order.timestamps["Shipped"])}. When it arrives, confirm delivery — that's what releases the funds.`;
    }
    if (idx >= 1) {
      return `Payment is confirmed and ${seller} has been asked to ship. You'll see this timeline move to Shipped when they mark it.`;
    }
    return `Shipping starts after payment is confirmed. Right now this order is still ${order.state}.`;
  }

  if (/(cancel|refund|never|doesn|not ship|trust|protect|safe)/.test(q)) {
    return `Nothing releases to the seller until you confirm delivery. If the order never ships, the held ${naira(order.amount)} is returned to the buyer — that's the whole point of the hold.`;
  }

  if (/(confirm.*deliver|deliver.*confirm)/.test(q)) {
    return `Confirming delivery is the final step: it releases ${naira(order.amount)} from the Monnify hold to ${seller}'s settlement account and marks the order Completed. Only do it once the item is in your hands.`;
  }

  return `Order ${order.id} — ${order.item}, ${naira(order.amount)}, currently ${order.state}. Ask me about the payment, delivery, or when funds release.`;
}
