"use client";

import AppHeader, { AppFooter } from "@/components/AppHeader";
import Amount from "@/components/Amount";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import ProductImage from "@/components/ProductImage";
import { Hallmark } from "@/components/Seal";
import { useDemo } from "@/lib/store";

// The page Ada shares on WhatsApp — what Tobi lands on.
export default function ProductPage() {
  const { product, seller } = useDemo();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <ProductImage product={product} className="aspect-[4/3] md:aspect-square" />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Hallmark size={17} />
              <span className="font-medium text-ink/80">{seller.store}</span>
              <span className="caption text-ink/45">Verified seller</span>
            </div>

            <h1 className="display-l mt-3">{product.name}</h1>
            <Amount className="data mt-2 text-[22px]" value={product.price} />
            <p className="mt-4 leading-relaxed text-ink/70">{product.description}</p>

            <div className="mt-8 border-t border-ink/12 pt-6">
              <Button href={`/p/${product.id}/checkout`} size="lg" className="w-full">
                Proceed to Secure Payment
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-ink/55">
                <Icon name="lock" size={13} />
                Held by Monnify until you confirm delivery
              </p>
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
