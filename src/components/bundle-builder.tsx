"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatRsd } from "@/lib/commerce";
import { addBundleAction, previewBundleAction } from "@/server/feature-actions";

type Variant = { variantId: string; size: string; color: string | null; priceMinor: number; image: string | null };
type Product = { productId: string; name: string; image: string | null; variants: Variant[] };

export function BundleBuilder({
  products,
  target,
  locale,
}: {
  products: Product[];
  target: number;
  locale: "sr" | "en";
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<{ variantId: string; quantity: number; name: string; image: string | null; size: string }[]>([]);
  const [quote, setQuote] = useState<{ originalMinor: number; discountMinor: number; finalMinor: number } | null>(null);
  const [message, setMessage] = useState("");
  const selected = picks.reduce((sum, pick) => sum + pick.quantity, 0);
  const grouped = useMemo(() => products, [products]);

  async function refresh(next: typeof picks) {
    const result = await previewBundleAction(next.map((pick) => ({ variantId: pick.variantId, quantity: pick.quantity })));
    if (result.ok) setQuote({ originalMinor: result.originalMinor, discountMinor: result.discountMinor, finalMinor: result.finalMinor });
    else setQuote(null);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <p className="text-lg">Odabrali ste {selected} od {target} pari.</p>
        <div className="mt-3 h-2 bg-line"><div className="h-2 bg-moss" style={{ width: `${Math.min(100, (selected / target) * 100)}%` }} /></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {grouped.map((product) => (
            <article key={product.productId} className="border border-line p-3">
              {product.image ? <img src={product.image} alt={product.name} className="h-40 w-full object-cover" /> : null}
              <h2 className="mt-3 text-xl">{product.name}</h2>
              <div className="mt-3 grid gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.variantId}
                    type="button"
                    className="btn ghost min-h-0 justify-between"
                    onClick={async () => {
                      const next = [...picks, { variantId: variant.variantId, quantity: 1, name: product.name, image: variant.image, size: variant.size }];
                      setPicks(next);
                      await refresh(next);
                    }}
                  >
                    <span>{variant.size}{variant.color ? ` · ${variant.color}` : ""}</span>
                    <span>{formatRsd(variant.priceMinor, locale)}</span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
      <aside className="h-fit border border-line bg-paper-2 p-5">
        <h2 className="text-2xl">Vaš paket</h2>
        <ul className="mt-4 grid gap-3">
          {picks.map((pick, index) => (
            <li key={`${pick.variantId}-${index}`} className="flex gap-3 text-sm">
              {pick.image ? <img src={pick.image} alt="" className="h-14 w-14 object-cover" /> : null}
              <span>{pick.name}<br />{pick.size}</span>
              <button type="button" className="ml-auto underline" onClick={async () => {
                const next = picks.filter((_, item) => item !== index);
                setPicks(next);
                await refresh(next);
              }}>Ukloni</button>
            </li>
          ))}
        </ul>
        {quote ? (
          <div className="mt-4 grid gap-1 text-sm">
            <p className="flex justify-between"><span>Cena bez popusta</span><span>{formatRsd(quote.originalMinor, locale)}</span></p>
            <p className="flex justify-between"><span>Popust</span><span>{formatRsd(quote.discountMinor, locale)}</span></p>
            <p className="flex justify-between text-lg"><span>Paket</span><span>{formatRsd(quote.finalMinor, locale)}</span></p>
          </div>
        ) : <p className="mt-4 text-sm text-muted">Popust se računa na serveru kada izbor bude važeći.</p>}
        {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
        <button
          className="btn mt-4 w-full"
          type="button"
          disabled={selected !== target}
          onClick={async () => {
            const result = await addBundleAction(picks.map((pick) => ({ variantId: pick.variantId, quantity: pick.quantity })));
            if (!result.ok) setMessage("Paket nije dodat. Proverite količinu, stanje i pravila kampanje.");
            else router.push("/korpa");
          }}
        >Dodaj paket u korpu</button>
      </aside>
    </div>
  );
}
