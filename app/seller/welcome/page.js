"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import Seal from "@/components/Seal";
import { useDemo } from "@/lib/store";
import { formatAccount } from "@/lib/orders";

// The moment the reserved account exists — the account number is revealed
// inside a stamped seal, pressed onto the page.
export default function SellerWelcome() {
  const { seller, showToast } = useDemo();
  const account = seller.account;
  const [stamped, setStamped] = useState(false);

  useEffect(() => {
    // Only trigger the stamp animation once we actually have an account to
    // reveal — otherwise the seal presses onto an empty circle.
    if (!account) return;
    const t = setTimeout(() => setStamped(true), 900);
    return () => clearTimeout(t);
  }, [account]);

  const copy = async () => {
    if (!account?.number) return;
    try {
      await navigator.clipboard.writeText(account.number);
      showToast("Account number copied");
    } catch {
      showToast(`Account number: ${account.number}`);
    }
  };

  // If Monnify skipped account creation (no BVN in production, or a
  // sandbox hiccup), the register route still succeeds. Surface it here
  // instead of stamping a blank seal.
  if (!account) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
        <p className="caption text-brass">
          {seller.name ? "Almost there" : "Loading…"}
        </p>
        {seller.name && (
          <>
            <h1 className="display-l mt-3 max-w-[24ch]">
              We couldn’t open your reserved account yet.
            </h1>
            <p className="mt-4 max-w-[48ch] leading-relaxed text-ink/70">
              Monnify usually needs a BVN to create your account. Add it in your profile
              and we’ll try again — until then, your ledger still works.
            </p>
            <div className="mt-8">
              <Button href="/seller">
                Go to your dashboard
                <Icon name="arrow-right" size={16} />
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <p className="caption text-brass">
        {stamped ? "Your reserved account" : "Creating your reserved account"}
      </p>
      <h1 className="display-l mt-3 max-w-[22ch]">
        {stamped
          ? `${seller.name?.split(" ")[0] ?? "You"}, this account is yours.`
          : "One moment —"}
      </h1>

      <div className="relative mt-10 h-[300px] w-[300px] sm:h-[360px] sm:w-[360px]">
        {stamped ? (
          <div className="absolute inset-0">
            <Seal size="100%" stamping className="h-full w-full">
              <span className="caption text-ink/60">{seller.name}</span>
              <span className="lining mt-2 whitespace-nowrap font-display text-[26px] font-semibold leading-none text-brass sm:text-[31px]">
                {formatAccount(account.number)}
              </span>
              <span className="caption mt-3 text-ink/50">
                {account.bank} · via Monnify
              </span>
            </Seal>
          </div>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-full border border-dashed border-ink/20"
            aria-label="Creating your reserved account with Monnify"
          >
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="waiting-dot h-2 w-2 rounded-full bg-brass"
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {stamped && (
        <div className="rise-in-delayed mt-10 flex max-w-[46ch] flex-col items-center">
          <p className="leading-relaxed text-ink/70">
            Share this number for every sale. Monnify confirms each transfer the moment it lands —
            screenshots never enter the picture.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button href="/seller">
              Go to your dashboard
              <Icon name="arrow-right" size={16} />
            </Button>
            <Button variant="secondary" onClick={copy}>
              <Icon name="copy" size={15} />
              Copy account number
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
