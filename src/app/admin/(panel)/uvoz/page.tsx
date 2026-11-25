import { loadSourceCatalog } from "@/server/source-catalog";
import { requireDb } from "@/db";
import { products } from "@/db/schema";

export default async function Page() {
  const source = loadSourceCatalog();
  const db = await requireDb();
  const existing = await db.select({ slug: products.slug, sku: products.id }).from(products);
  const slugs = new Set(existing.map((item) => item.slug));
  const missing = source.products.filter((product) => !slugs.has(product.dto.slug));
  const withoutSku = source.products.filter((product) => product.dto.variants.every((variant) => !variant.sku)).length;
  return (
    <>
      <h1 className="text-4xl">Uvoz</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6">
        Izvor: proizvodnjacarapa.com. U bazi je {existing.length} proizvoda. Nedostaje {missing.length}.
        Bez šifre: {withoutSku}. Uvoz ne briše postojeće. Količine i šifre nisu bile u javnom katalogu.
      </p>
      <p className="mt-4 text-sm">Šablon: <a href="/templates/stock-import-template.csv">stock-import-template.csv</a></p>
    </>
  );
}
