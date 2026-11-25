import { Suspense } from "react";
import { takeLocale } from "@/i18n/locale";
import { BundleBuilder } from "@/components/bundle-builder";
import { bundleCatalog } from "@/server/features";
import { decodeBasicEntities } from "@/lib/text";

async function Body({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  let data: Awaited<ReturnType<typeof bundleCatalog>> | null = null;
  try {
    data = await bundleCatalog();
  } catch {
    data = null;
  }
  if (!data?.pack) {
    return (
      <div className="wrap py-16">
        <h1 className="text-5xl">Napravi svoj paket</h1>
        <p className="mt-4 max-w-xl">Administrator još nije uključio kampanju za pakete. Popust se ne prikazuje dok pravilo nije sačuvano.</p>
      </div>
    );
  }
  const products = new Map<string, { productId: string; name: string; image: string | null; variants: { variantId: string; size: string; color: string | null; priceMinor: number; image: string | null }[] }>();
  for (const row of data.rows) {
    const product = products.get(row.productId) ?? { productId: row.productId, name: decodeBasicEntities(row.name), image: row.image, variants: [] };
    if (!product.variants.some((variant) => variant.variantId === row.variantId)) {
      product.variants.push({ variantId: row.variantId, size: row.size, color: row.color, priceMinor: row.priceMinor, image: row.image });
    }
    products.set(row.productId, product);
  }
  const target = data.pack.rules.map((rule) => rule.minPairs).sort((a, b) => a - b)[0] ?? data.pack.campaign.minPairs;
  return (
    <div className="wrap py-10">
      <h1 className="text-5xl">Napravi svoj paket</h1>
      <p className="mt-3 max-w-2xl text-muted">{data.pack.campaign.name}. Veličina i boja biraju se za svaki par. Cena paketa stiže sa servera.</p>
      <div className="mt-8">
        <BundleBuilder products={[...products.values()]} target={target} locale={locale} />
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <Suspense fallback={<div className="wrap py-16">…</div>}><Body params={params} /></Suspense>;
}
