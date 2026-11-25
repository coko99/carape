"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import type { ProductDTO } from "@/lib/catalog";
import { addToCartAction } from "@/server/actions";

export function BuyBox({
  product,
  locale,
  labels,
}: {
  product: ProductDTO;
  locale: "sr" | "en";
  labels: {
    size: string;
    add: string;
    added: string;
    priceNote: string;
    quantity: string;
    stockUnknown: string;
    stockOut: string;
    disabled: string;
    commerce: boolean;
  };
}) {
  const first = product.variants.find((item) => item.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(first?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const variant = product.variants.find((item) => item.id === variantId) ?? first;

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!labels.commerce || !variant) return;
        start(async () => {
          const result = await addToCartAction(variant.id, quantity);
          setMessage(result.ok ? labels.added : labels.disabled);
          if (result.ok) router.refresh();
        });
      }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">{labels.size}</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={labels.size}>
          {product.variants.map((item) => (
            <button
              key={item.id}
              type="button"
              className="size-pick"
              aria-pressed={item.id === variant?.id}
              disabled={!item.inStock}
              onClick={() => setVariantId(item.id)}
            >
              {item.size}
            </button>
          ))}
        </div>
      </div>
      <label className="field max-w-28">
        <span>{labels.quantity}</span>
        <input
          type="number"
          min={1}
          max={99}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
      </label>
      <p className="text-sm text-muted">{labels.priceNote}</p>
      <p className="text-sm">{variant?.inStock ? labels.stockUnknown : labels.stockOut}</p>
      <button className="btn" type="submit" disabled={pending || !labels.commerce || !variant?.inStock}>
        {message || labels.add}
      </button>
      {!labels.commerce ? <p className="text-sm text-clay">{labels.disabled}</p> : null}
    </form>
  );
}
