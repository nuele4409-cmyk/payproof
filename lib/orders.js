// The order state machine — these exact six states appear everywhere in the UI.
export const ORDER_STATES = [
  "PendingPayment",
  "Paid",
  "AwaitingShipment",
  "Shipped",
  "Delivered",
  "Completed",
];

export function stateIndex(state) {
  return ORDER_STATES.indexOf(state);
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString("en-NG");
}

// "9928447103" -> "9928 4471 03"
export function formatAccount(number) {
  return String(number).replace(/(\d{4})(\d{4})(\d{2})/, "$1 $2 $3");
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
