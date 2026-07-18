"use client";

import { useState } from "react";
import { answerFor, suggestionsFor } from "@/lib/assistant";
import Icon from "./Icon";

// Order-scoped, embedded inline — deliberately not a floating chat bubble.
export default function AssistantPanel({ order }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [thinking, setThinking] = useState(false);

  const ask = (text) => {
    setMsgs((m) => [...m, { role: "user", text }]);
    setThinking(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { role: "assistant", text: answerFor(order, text) }]);
      setThinking(false);
    }, 700);
  };

  return (
    <section aria-label="Order assistant" className="rounded-card border border-ink/12 bg-paper p-5">
      <h2 className="caption text-ink/55">Order assistant</h2>
      <p className="mt-1 text-[13px] text-ink/50">
        Answers come from this order’s payment record — not from the seller.
      </p>

      {msgs.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-card bg-ink/5 px-3.5 py-2.5 text-sm">{m.text}</div>
              </div>
            ) : (
              <div key={i} className="max-w-[92%] rounded-card border border-ink/10 bg-parchment/60 px-3.5 py-2.5 text-sm leading-relaxed">
                {m.text}
              </div>
            ),
          )}
        </div>
      )}

      {thinking && (
        <div className="mt-2.5 flex items-center gap-1 px-1 py-1.5" aria-label="Checking the record">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="waiting-dot h-1.5 w-1.5 rounded-full bg-ink/50"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>
      )}

      {msgs.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestionsFor(order).map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-control border border-ink/15 px-3 py-1.5 text-[13px] text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = q.trim();
          if (t && !thinking) {
            ask(t);
            setQ("");
          }
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about this order"
          className="h-10 flex-1 rounded-control border border-ink/15 bg-parchment/50 px-3 text-sm transition-colors focus:border-bottle"
        />
        <button
          aria-label="Send question"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-bottle text-paper transition-colors hover:bg-bottle-dark"
        >
          <Icon name="send" size={15} />
        </button>
      </form>
    </section>
  );
}
