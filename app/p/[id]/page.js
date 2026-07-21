"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Amount from "@/components/Amount";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import ProductImage from "@/components/ProductImage";
import { Hallmark } from "@/components/Seal";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api";

// The page a seller shares on WhatsApp — the storefront for a single listing.
export default function ProductPage() {
  const { id } = useParams();
  const { user } = useDemo();
  const [product, setProduct] = useState(null);
  const [status, setStatus]   = useState("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await api.products.get(id);
        if (!alive) return;
        if (!p) { setStatus("notfound"); return; }
        setProduct(p);
        setStatus("ready");
      } catch {
        if (alive) setStatus("notfound");
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-ink/45">Loading storefront…</p>
        </main>
      </div>
    );
  }

  if (status === "notfound" || !product) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-[540px] flex-1 flex-col items-center justify-center px-4 text-center">
          <h1 className="display-l">Storefront not found</h1>
          <p className="mt-3 text-ink/60">
            The link may be wrong, or this seller hasn&apos;t set up their listing yet.
          </p>
        </main>
        <AppFooter />
      </div>
    );
  }

  const store = product.seller?.store ?? "Seller";

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <ProductImage product={product} className="aspect-[4/3] md:aspect-square" />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Hallmark size={17} />
              <span className="font-medium text-ink/80">{store}</span>
              <span className="caption text-ink/45">Verified seller</span>
            </div>

            <h1 className="display-l mt-3">{product.name}</h1>
            <Amount className="data mt-2 text-[22px]" value={product.price} />
            <p className="mt-4 leading-relaxed text-ink/70">{product.description}</p>

            <div className="mt-8 border-t border-ink/12 pt-6">
              {user?.id === product.seller?.id ? (
                <div className="space-y-3">
                  <Button href="/seller/product" variant="secondary" size="lg" className="w-full">
                    Edit this listing
                  </Button>
                  <Button href="/seller" variant="ghost" size="sm" className="w-full">
                    Back to your ledger →
                  </Button>
                </div>
              ) : (
                <>
                  <Button href={`/p/${product.id}/checkout`} size="lg" className="w-full">
                    Proceed to Secure Payment
                  </Button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-ink/55">
                    <Icon name="lock" size={13} />
                    Held by Monnify until you confirm delivery
                  </p>
                </>
              )}
            </div>

            <ul className="mt-6 space-y-2 text-[13px] text-ink/60">
              {[
                "Payment confirmed by the bank, not by screenshots",
                "The seller is only paid after you confirm delivery",
                "Free for buyers — no extra charge",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-bottle" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
