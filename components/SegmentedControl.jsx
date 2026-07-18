"use client";

// A real, visible fork — not a dropdown.
export default function SegmentedControl({ options, value, onChange, className = "" }) {
  return (
    <div
      role="radiogroup"
      className={`grid grid-cols-2 gap-1 rounded-control border border-ink/15 bg-parchment/60 p-1 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-[4px] text-sm transition-colors ${
              active
                ? "border border-ink/12 bg-paper font-semibold text-ink"
                : "font-medium text-ink/55 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
