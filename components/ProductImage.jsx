// Product photo, or a ledger-engraving sneaker sketch as the default.
function SneakerSketch({ className = "" }) {
  return (
    <svg viewBox="0 0 260 150" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* sole */}
      <path d="M18 112 C 14 98 26 92 44 90 L 200 74 C 226 72 240 80 240 92 L 240 96 C 240 108 228 112 214 113 L 40 122 C 26 122 20 120 18 112 Z" />
      {/* sole tread ticks */}
      <g strokeWidth="1.5" opacity="0.55">
        <path d="M40 118l5-7" />
        <path d="M62 116l5-7" />
        <path d="M84 115l5-7" />
        <path d="M106 113l5-7" />
        <path d="M128 112l5-7" />
        <path d="M150 110l5-7" />
        <path d="M172 108l5-7" />
        <path d="M194 107l5-7" />
        <path d="M216 105l5-7" />
      </g>
      {/* upper */}
      <path d="M44 90 C 40 62 48 46 66 42 C 84 39 96 48 112 57 C 134 69 158 72 186 74" />
      {/* heel detail */}
      <path d="M54 64 C 62 59 70 61 74 68" strokeWidth="1.5" opacity="0.7" />
      {/* toe cap */}
      <path d="M196 74 C 212 74 228 80 237 89" strokeWidth="1.5" opacity="0.7" />
      {/* eyestay + laces */}
      <path d="M92 52 L 122 86" strokeWidth="1.5" />
      <g strokeWidth="1.5" opacity="0.8">
        <path d="M90 58 l 22 7" />
        <path d="M92 67 l 22 7" />
        <path d="M95 76 l 20 7" />
      </g>
      {/* side panel line */}
      <path d="M122 86 C 148 92 168 88 186 76" strokeWidth="1.5" opacity="0.7" />
      {/* stitch line above sole */}
      <path d="M46 96 L 208 81" strokeWidth="1.25" strokeDasharray="3 4" opacity="0.6" />
    </svg>
  );
}

export default function ProductImage({ product, className = "" }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-card border border-ink/10 bg-parchment/70 ${className}`}
    >
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
      ) : (
        <SneakerSketch className="w-[72%] max-w-[340px] text-ink/60" />
      )}
    </div>
  );
}
