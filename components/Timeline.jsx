"use client";

import { ORDER_STATES, formatDateTime, stateIndex } from "@/lib/orders";
import Icon from "./Icon";

// The "Paid" node is a miniature of the Seal — the record's hallmark.
function PaidStamp({ className = "" }) {
  return (
    <svg viewBox="0 0 30 30" width="30" height="30" className={`shrink-0 ${className}`} aria-hidden="true">
      <g transform="rotate(-8 15 15)" fill="none" stroke="var(--color-brass)">
        <circle cx="15" cy="15" r="13.4" strokeWidth="1.6" />
        <circle cx="15" cy="15" r="10.6" strokeWidth="2" strokeDasharray="1.2 2.2" />
        <path
          d="M9.8 15.6l3.3 3.3 7-7.4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

function Node({ state, status, stampAnimated }) {
  if (state === "Paid" && status === "done") {
    return <PaidStamp className={stampAnimated ? "seal-stamping" : ""} />;
  }
  if (status === "done") {
    return (
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-bottle text-paper">
        <Icon name="check" size={14} strokeWidth={2.25} />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="node-pulse flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 border-bottle bg-paper">
        <span className="h-2 w-2 rounded-full bg-bottle" />
      </span>
    );
  }
  return <span className="h-[30px] w-[30px] shrink-0 rounded-full border border-ink/20 bg-paper/60" />;
}

function labelCls(status) {
  if (status === "current") return "font-semibold text-ink";
  if (status === "done") return "font-medium text-ink/75";
  return "font-normal text-ink/40";
}

export default function Timeline({ order, stampedPaid = false, className = "" }) {
  const idx = stateIndex(order.state);
  const completed = order.state === "Completed";
  const statusOf = (i) => (i < idx || completed ? "done" : i === idx ? "current" : "future");

  return (
    <div className={className}>
      {/* desktop — a horizontal run of the six states */}
      <ol className="hidden md:flex">
        {ORDER_STATES.map((s, i) => (
          <li key={s} className="relative flex flex-1 flex-col items-center gap-2.5 px-1">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute left-[calc(-50%+22px)] top-[15px] h-px w-[calc(100%-44px)] ${
                  i <= idx || completed ? "bg-bottle/40" : "bg-ink/12"
                }`}
              />
            )}
            <Node state={s} status={statusOf(i)} stampAnimated={stampedPaid} />
            <div className="text-center">
              <div className={`text-[13px] leading-tight ${labelCls(statusOf(i))}`}>{s}</div>
              {order.timestamps[s] && (
                <div className="data mt-1 text-[11px] font-normal text-ink/45">
                  {formatDateTime(order.timestamps[s])}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* mobile — the same ledger, run vertically */}
      <ol className="md:hidden">
        {ORDER_STATES.map((s, i) => (
          <li key={s} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <Node state={s} status={statusOf(i)} stampAnimated={stampedPaid} />
              {i < ORDER_STATES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`w-px flex-1 ${i < idx || completed ? "bg-bottle/40" : "bg-ink/12"}`}
                  style={{ minHeight: 18 }}
                />
              )}
            </div>
            <div className={i < ORDER_STATES.length - 1 ? "pb-5 pt-1" : "pt-1"}>
              <div className={`text-sm leading-tight ${labelCls(statusOf(i))}`}>{s}</div>
              {order.timestamps[s] && (
                <div className="data mt-0.5 text-[11px] font-normal text-ink/45">
                  {formatDateTime(order.timestamps[s])}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
