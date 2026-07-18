"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Button from "@/components/Button";
import { Field, TextArea } from "@/components/Field";
import Icon from "@/components/Icon";
import ProductCard from "@/components/ProductCard";
import { useDemo } from "@/lib/store";

export default function SellerProduct() {
  const { ready, product, setProduct, seller, showToast } = useDemo();
  const [draft, setDraft] = useState(product);
  const seeded = useRef(false);

  useEffect(() => {
    if (ready && !seeded.current) {
      setDraft(product);
      seeded.current = true;
    }
  }, [ready, product]);

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = (e) => {
    e.preventDefault();
    setProduct(draft);
    showToast("Listing saved");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="display-l">Your listing</h1>
        <p className="mt-2 max-w-[52ch] text-ink/60">
          One product for now — make it count. Buyers see exactly what’s in the preview.
        </p>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <form onSubmit={save} className="max-w-[520px] space-y-5">
            <Field
              label="Product name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Air Jordan 1 Low (Panda)"
            />
            <Field
              label="Price (₦)"
              type="number"
              min="0"
              step="100"
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) || 0 }))}
            />
            <TextArea
              label="Description"
              rows={4}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              hint="Say what it is, the condition, and how delivery works."
            />

            <div>
              <span className="text-sm font-medium text-ink/80">Photo</span>
              <label className="mt-1.5 flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-ink/25 bg-parchment/50 text-ink/55 transition-colors hover:border-bottle/50 hover:text-ink/80">
                <Icon name="image" size={20} />
                <span className="text-[13px]">
                  {draft.image ? "Replace the photo" : "Upload a photo — or keep the sketch"}
                </span>
                <input type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
              </label>
              {draft.image && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, image: null }))}
                  className="mt-2 text-[13px] text-rust underline-offset-2 hover:underline"
                >
                  Remove photo
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit">Save listing</Button>
              <Link
                href="/p/aj1-low"
                className="text-sm font-medium text-bottle underline-offset-2 hover:underline"
              >
                Open product page →
              </Link>
            </div>
          </form>

          <aside>
            <p className="caption text-ink/45">What Tobi sees</p>
            <div className="mt-3 lg:sticky lg:top-6">
              <ProductCard product={draft} seller={seller} />
              <p className="mt-3 text-[13px] text-ink/50">
                Your product page updates the moment you save.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
