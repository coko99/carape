"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatRsd } from "@/lib/commerce";
import { addToCartAction } from "@/server/actions";

type RailVariant = { id: string; size: string; inStock: boolean };
type RailProduct = {
  slug: string;
  name: string;
  priceMinor: number;
  image: string | null;
  alt: string;
  variants: RailVariant[];
};

export function SockRail({
  products,
  locale,
  commerce,
}: {
  products: RailProduct[];
  locale: "sr" | "en";
  commerce: boolean;
}) {
  const t = useTranslations("product");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [notedSlug, setNotedSlug] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [, start] = useTransition();
  if (products.length === 0) return null;
  const loop = [...products, ...products];

  function add(variant: RailVariant) {
    if (!commerce || !variant.inStock || pendingId) return;
    setPendingId(variant.id);
    start(async () => {
      const result = await addToCartAction(variant.id, 1);
      setPendingId(null);
      setOpenSlug(null);
      setNotedSlug(variant.id);
      setNote(result.ok ? (locale === "sr" ? "Dodato" : "Added") : t("stockOut"));
      if (result.ok) router.refresh();
      window.setTimeout(() => {
        setNote("");
        setNotedSlug(null);
      }, 1600);
    });
  }

  return (
    <section className="sock-rail" aria-label={locale === "sr" ? "Čarape u prolazu" : "Socks in motion"}>
      <div className="sock-rail-track">
        {loop.map((product, index) => {
          const purchasable = product.variants.filter((variant) => variant.inStock);
          const open = openSlug === product.slug && index < products.length;
          return (
            <article key={`${product.slug}-${index}`} className="sock-card">
              <Link href={{ pathname: "/proizvod/[slug]", params: { slug: product.slug } }}>
                {product.image ? <img src={product.image} alt={index < products.length ? product.alt : ""} /> : <span className="sock-card-empty" />}
              </Link>
              <div className="sock-card-copy">
                <strong>{product.name}</strong>
                <span>{formatRsd(product.priceMinor, locale)}</span>
                {commerce && index < products.length ? (
                  open && purchasable.length > 1 ? (
                    <div className="sock-sizes">
                      {purchasable.map((variant) => (
                        <button key={variant.id} type="button" disabled={pendingId === variant.id} onClick={() => add(variant)}>
                          {variant.size}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="sock-add"
                      disabled={purchasable.length === 0 || Boolean(pendingId)}
                      onClick={() => (purchasable.length === 1 && purchasable[0] ? add(purchasable[0]) : setOpenSlug(product.slug))}
                    >
                      {note && notedSlug && product.variants.some((variant) => variant.id === notedSlug) ? note : purchasable.length === 0 ? t("stockOut") : locale === "sr" ? "Dodaj u korpu" : "Add to cart"}
                    </button>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
