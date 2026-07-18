"use client";

import { useId } from "react";

// The circular brass hallmark — used in exactly three places:
// 1. the reserved-account reveal, 2. the "Paid" moment, 3. the small verified badge.
function SealRing() {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full text-brass" aria-hidden="true">
      <defs>
        <filter id={`rough-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" />
        </filter>
        <path id={`arcTop-${uid}`} d="M 30 100 A 70 70 0 0 1 170 100" fill="none" />
        <path id={`arcBottom-${uid}`} d="M 26 100 A 74 74 0 0 0 174 100" fill="none" />
      </defs>
      <circle cx="100" cy="100" r="99" fill="rgba(169,120,47,0.05)" />
      <g filter={`url(#rough-${uid})`} stroke="currentColor" fill="none">
        <circle cx="100" cy="100" r="97" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="90" strokeWidth="4" strokeDasharray="1.6 3.4" opacity="0.9" />
        <circle cx="100" cy="100" r="84" strokeWidth="1" />
        <circle cx="100" cy="100" r="60" strokeWidth="1" />
      </g>
      <g
        fill="currentColor"
        style={{
          fontFamily: "var(--font-plex-sans), sans-serif",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "3px",
        }}
      >
        <text>
          <textPath href={`#arcTop-${uid}`} startOffset="50%" textAnchor="middle">
            ✦ PAYPROOF ✦
          </textPath>
        </text>
        <text>
          <textPath href={`#arcBottom-${uid}`} startOffset="50%" textAnchor="middle">
            VERIFIED BY MONNIFY
          </textPath>
        </text>
      </g>
    </svg>
  );
}

/**
 * stamping — plays the press-and-settle animation (mount it at the moment it stamps).
 * Otherwise the seal sits at rest with its slight, honest -3° skew.
 */
export default function Seal({ size = 300, stamping = false, className = "", children }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {stamping && <div className="seal-glow absolute inset-0" aria-hidden="true" />}
      <div className={`absolute inset-0 ${stamping ? "seal-stamping" : "seal-rest"}`}>
        <SealRing />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-[19%] text-center">
          {children}
        </div>
      </div>
    </div>
  );
}

// Small static hallmark — the verified-seller badge.
export function Hallmark({ size = 18, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--color-brass)" />
      <circle
        cx="12"
        cy="12"
        r="8.6"
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth="0.9"
        strokeDasharray="1 1.6"
        opacity="0.7"
      />
      <path
        d="M7.8 12.4l2.7 2.7 5.4-5.7"
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VerifiedSeller({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Hallmark size={16} />
      <span className="caption text-ink/55">Verified seller</span>
    </span>
  );
}
