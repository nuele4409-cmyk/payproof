const inputCls =
  "mt-1.5 block w-full rounded-control border border-ink/15 bg-parchment/50 px-3.5 text-[16px] text-ink transition-colors focus:border-bottle";

export function Field({ label, hint, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-ink/80">{label}</span>
      <input className={`${inputCls} h-11`} {...props} />
      {hint && <span className="mt-1.5 block text-[13px] text-ink/50">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, rows = 4, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-ink/80">{label}</span>
      <textarea rows={rows} className={`${inputCls} py-2.5 leading-relaxed`} {...props} />
      {hint && <span className="mt-1.5 block text-[13px] text-ink/50">{hint}</span>}
    </label>
  );
}
