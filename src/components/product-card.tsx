"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatRsd } from "@/lib/commerce";
import type { ProductDTO, VariantDTO } from "@/lib/catalog";
import { categoryTypeLabel } from "@/lib/type-groups";
import { addToCartAction } from "@/server/actions";

export function ProductCard({
  product,
  locale,
  colors = [],
  commerce = false,
}: {
  product: ProductDTO;
  locale: "sr" | "en";
  colors?: { slug: string; name: string; hex: string | null }[];
  commerce?: boolean;
}) {
  const t = useTranslations("product");
  const router = useRouter();
  const swatches = [...new Map(product.variants.filter((variant) => variant.color).map((variant) => [variant.color, variant])).values()];
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const chosen = swatches.find((variant) => variant.color === selected);
  const imageSrc = chosen?.image ?? product.images[0]?.src;
  const imageAlt = product.images[0]?.alt ?? product.name;
  const sizes = product.variants.filter((variant) => !selected || variant.color === selected);
  const purchasable = sizes.filter((variant) => variant.inStock);

  function add(variant: VariantDTO) {
    if (!commerce || !variant.inStock || pending) return;
    start(async () => {
      const result = await addToCartAction(variant.id, 1);
      setPicking(false);
      setNote(result.ok ? t("addedShort") : t("stockOut"));
      if (result.ok) router.refresh();
      window.setTimeout(() => setNote(""), 1600);
    });
  }

  function onQuickAdd() {
    if (purchasable.length === 1) {
      const only = purchasable[0];
      if (only) add(only);
      return;
    }
    setPicking((open) => !open);
  }

  return (
    <article className="product-card group">
      <div className="card-media">
        <Link href={{ pathname: "/proizvod/[slug]", params: { slug: product.slug } }} className="absolute inset-0 block no-underline">
          {imageSrc ? (
            <Image src={imageSrc} alt={imageAlt} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-[1.02]" />
          ) : null}
        </Link>
        {commerce ? (
          <div className="quick-add">
            {picking && purchasable.length > 1 ? (
              <div className="quick-sizes" role="group" aria-label={t("size")}>
                {sizes.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className="quick-size"
                    disabled={pending || !variant.inStock}
                    onClick={() => add(variant)}
                  >
                    {variant.size}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" className="quick-add-btn" disabled={pending || purchasable.length === 0} onClick={onQuickAdd}>
                {note || (purchasable.length === 0 ? t("stockOut") : t("quickAdd"))}
              </button>
            )}
          </div>
        ) : null}
      </div>
      <Link href={{ pathname: "/proizvod/[slug]", params: { slug: product.slug } }} className="mt-3 flex items-baseline justify-between gap-3 no-underline">
        <h3 className="leading-tight">{product.name}</h3>
        <p className="price shrink-0 text-sm">{formatRsd(product.priceMinor, locale)}</p>
      </Link>
      {swatches.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {swatches.map((variant) => {
            const color = colors.find((item) => item.slug === variant.color);
            return (
              <button
                key={variant.color}
                type="button"
                className={`h-6 w-6 rounded-full border ${selected === variant.color ? "border-ink" : "border-line"}`}
                style={{ background: color?.hex ?? "transparent" }}
                aria-label={color?.name ?? variant.color ?? "Boja"}
                aria-pressed={selected === variant.color}
                onClick={() => setSelected(variant.color)}
              />
            );
          })}
        </div>
      ) : null}
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">{categoryTypeLabel({ nameSr: product.categoryNames.find((name) => name !== "Najtraženiji proizvodi") ?? product.categoryNames[0] ?? "", nameEn: null }, locale, "title")}</p>
    </article>
  );
}

export function ProductGrid({
  products,
  locale,
  colors = [],
  commerce = false,
}: {
  products: ProductDTO[];
  locale: "sr" | "en";
  colors?: { slug: string; name: string; hex: string | null }[];
  commerce?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} locale={locale} colors={colors} commerce={commerce} />
      ))}
    </div>
  );
}
