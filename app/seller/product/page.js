"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader, { AppFooter } from "@/components/AppHeader";
import Button from "@/components/Button";
import { Field, TextArea } from "@/components/Field";
import Icon from "@/components/Icon";
import ProductCard from "@/components/ProductCard";
import { useDemo } from "@/lib/store";
import { api } from "@/lib/api";

const EMPTY_DRAFT = { name: "", price: 0, description: "", image: null };

export default function SellerProduct() {
  const { saveProduct, seller, showToast } = useDemo();
  const [draft, setDraft]   = useState(EMPTY_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy]     = useState(false);

  // Fetch this seller's own product (or null if they haven't created one).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await api.seller.getProduct();
        if (!alive) return;
        setDraft(p ?? EMPTY_DRAFT);
      } catch {
        // 401 while auth is still hydrating is normal — bounce here isn't
        // necessary because /seller/product is only reached from /seller.
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await saveProduct(draft);
      // Reflect the server-generated slug back into local state so the
      // "Open product page →" link points at the right URL immediately.
      setDraft(saved);
      showToast("Listing saved");
    } catch (err) {
      showToast(err.message || "Could not save listing");
    } finally {
      setBusy(false);
    }
  };

  const storefrontSlug = draft.id || seller.storefrontSlug;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="display-l">Your listing</h1>
        <p className="mt-2 max-w-[52ch] text-ink/60">
          One product for now — make it count. Buyers see exactly what's in the preview.
        </p>

        {!loaded ? (
          <p className="mt-10 text-sm text-ink/45">Loading your listing…</p>
        ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <form onSubmit={save} className="max-w-[520px] space-y-5">
            <Field
              label="Product name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Air Jordan 1 Low (Panda)"
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
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save listing"}
              </Button>
              {storefrontSlug && (
                <Link
                  href={`/p/${storefrontSlug}`}
                  className="text-sm font-medium text-bottle underline-offset-2 hover:underline"
                >
                  Open product page →
                </Link>
              )}
            </div>
          </form>

          <aside>
            <p className="caption text-ink/45">Buyer preview</p>
            <div className="mt-3 lg:sticky lg:top-6">
              <ProductCard product={draft} seller={seller} />
              <p className="mt-3 text-[13px] text-ink/50">
                Your product page updates the moment you save.
              </p>
            </div>
          </aside>
        </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
