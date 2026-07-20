"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "@/lib/store";

const LINKS = [
  { href: "/buyer", label: "Buyer", match: (p) => p.startsWith("/buyer") || p.startsWith("/orders") || p.startsWith("/pay") },
  { href: "/seller", label: "Seller", match: (p) => p.startsWith("/seller") },
];

export default function AppHeader() {
  const path = usePathname();
  return (
    <header className="border-b border-ink/12 bg-paper">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href="/" className="font-display text-[19px] font-semibold tracking-tight text-ink">
          PayProof
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {LINKS.map((l) => {
            const active = l.match(path);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-control px-2.5 py-1.5 text-sm transition-colors sm:px-3 ${
                  active ? "bg-parchment font-medium text-ink" : "text-ink/60 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function AppFooter() {
  const { user, logout } = useDemo();
  return (
    <footer className="mt-16 border-t border-ink/12">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-8 sm:px-6">
        <span className="caption text-ink/40">Powered by Monnify</span>
        {user ? (
          <button
            onClick={logout}
            className="caption text-ink/40 transition-colors hover:text-rust"
          >
            Sign out ({user.name})
          </button>
        ) : (
          <Link href="/login" className="caption text-ink/40 transition-colors hover:text-ink">
            Sign in
          </Link>
        )}
      </div>
    </footer>
  );
}
