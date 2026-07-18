import Amount from "./Amount";
import ProductImage from "./ProductImage";
import { Hallmark } from "./Seal";

// The buyer-facing card — used as the live preview on the seller's listing form.
export default function ProductCard({ product, seller }) {
  return (
    <div className="overflow-hidden rounded-card border border-ink/12 bg-paper">
      <ProductImage
        product={product}
        className="aspect-[4/3] rounded-none border-0 border-b border-ink/10"
      />
      <div className="p-4">
        <div className="flex items-center gap-1.5">
          <Hallmark size={15} />
          <span className="text-[13px] font-medium text-ink/70">{seller.store}</span>
        </div>
        <h3 className="heading mt-2">{product.name || "Untitled product"}</h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-[13px] text-ink/55">{product.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <Amount className="data text-[17px]" value={product.price} />
          <span className="inline-flex h-9 items-center rounded-control bg-bottle px-3.5 text-[13px] font-medium text-paper">
            Proceed to Secure Payment
          </span>
        </div>
      </div>
    </div>
  );
}
