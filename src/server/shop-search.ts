import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { catalogColors, catalogSizes, catalogTypePrefs, companies, orderItems, priceListItems, priceLists } from "@/db/schema";
import { filterCatalog, priceBounds, type CatalogQuery, type ProductDTO } from "@/lib/catalog";
import { canonicalTypeKey, isTypeCategory, paginate, typeKey } from "@/lib/search";
import { describeType, type TypeChoice } from "@/lib/type-groups";
import { resolveUnitPrice } from "@/lib/pricing";
import { getAuth } from "@/lib/auth";
import { getCatalog } from "@/server/catalog";

const PAGE_SIZE = 24;

export async function viewerPricing(products: ProductDTO[]) {
  let approved = false;
  let tiers: { variantId: string; minQuantity: number; priceMinor: number }[] = [];
  try {
    const session = await (await getAuth()).api.getSession({ headers: await headers() });
    if (session) {
      const db = await getDb();
      if (db) {
        const [company] = await db.select().from(companies).where(eq(companies.userId, session.user.id));
        approved = company?.status === "approved";
        if (approved && company) {
          tiers = await db
            .select({ variantId: priceListItems.variantId, minQuantity: priceListItems.minQuantity, priceMinor: priceListItems.priceMinor })
            .from(priceListItems)
            .innerJoin(priceLists, eq(priceListItems.priceListId, priceLists.id))
            .where(eq(priceLists.companyId, company.id));
        }
      }
    }
  } catch {
    approved = false;
  }
  if (!approved) return products;
  return products.map((product) => {
    const variants = product.variants.map((variant) => {
      const own = tiers.filter((tier) => tier.variantId === variant.id);
      const floor = own.length ? Math.min(...own.map((tier) => tier.minQuantity)) : 1;
      const resolved = resolveUnitPrice({ retailMinor: variant.priceMinor, quantity: floor, approved: true, tiers: own });
      return { ...variant, priceMinor: resolved.unitMinor };
    });
    const priceMinor = variants.length ? Math.min(...variants.map((variant) => variant.priceMinor)) : product.priceMinor;
    return { ...product, variants, priceMinor };
  });
}

async function salesByProduct(products: ProductDTO[]) {
  const sales = new Map<string, number>();
  const db = await getDb();
  if (!db) return sales;
  const rows = await db
    .select({ variantId: orderItems.variantId, quantity: sql<number>`sum(${orderItems.quantity})::int` })
    .from(orderItems)
    .groupBy(orderItems.variantId);
  const productByVariant = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.id, product.id])));
  for (const row of rows) {
    if (!row.variantId) continue;
    const productId = productByVariant.get(row.variantId);
    if (!productId) continue;
    sales.set(productId, (sales.get(productId) ?? 0) + Number(row.quantity));
  }
  return sales;
}

export async function searchCatalog(query: CatalogQuery) {
  const catalog = await getCatalog();
  const priced = await viewerPricing(catalog.products);
  const scoped = filterCatalog(priced, {
    category: query.category,
    audience: query.audience,
    sale: query.sale,
    featured: query.featured,
    isNew: query.isNew,
  });
  const sales = await salesByProduct(priced);
  const matched = filterCatalog(scoped, query, sales);
  const page = paginate(matched, query.page, PAGE_SIZE);
  const db = await getDb();
  const colors = db ? await db.select().from(catalogColors) : [];
  const sizePrefs = db ? await db.select().from(catalogSizes) : [];
  const typePrefs = db ? await db.select().from(catalogTypePrefs) : [];
  const hiddenColors = new Set(colors.filter((color) => !color.visible).map((color) => color.slug));
  const hiddenSizes = new Set(sizePrefs.filter((size) => !size.visible).map((size) => size.label));
  const typeGroups = new Map<string, string[]>();
  for (const category of catalog.categories) {
    if (!isTypeCategory(category.slug) || !category.parentSlug) continue;
    const key = canonicalTypeKey(typeKey(category.nameSr));
    typeGroups.set(key, [...(typeGroups.get(key) ?? []), category.id]);
  }
  const hiddenTypes = new Set(
    [...typeGroups.entries()]
      .filter(([, ids]) => ids.every((id) => typePrefs.some((pref) => pref.categoryId === id && !pref.visible)))
      .map(([key]) => key),
  );
  const colorCounts = new Map<string, number>();
  const sizeCounts = new Map<string, { count: number; available: boolean }>();
  const typeCounts = new Map<string, TypeChoice & { count: number }>();
  for (const product of scoped) {
    const seenColors = new Set<string>();
    const seenSizes = new Set<string>();
    const seenTypes = new Set<string>();
    for (const variant of product.variants) {
      if (variant.color && !hiddenColors.has(variant.color)) seenColors.add(variant.color);
      if (!hiddenSizes.has(variant.size)) {
        const current = sizeCounts.get(variant.size) ?? { count: 0, available: false };
        if (!seenSizes.has(variant.size)) {
          current.count += 1;
          seenSizes.add(variant.size);
        }
        if (variant.inStock) current.available = true;
        sizeCounts.set(variant.size, current);
      }
    }
    for (const color of seenColors) colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
    for (const rawKey of product.typeKeys) {
      const key = canonicalTypeKey(rawKey);
      if (hiddenTypes.has(key) || seenTypes.has(key)) continue;
      seenTypes.add(key);
      const placed = describeType(key);
      const fallback = catalog.categories.find((category) => isTypeCategory(category.slug) && canonicalTypeKey(typeKey(category.nameSr)) === key)?.nameSr ?? key;
      const current = typeCounts.get(key) ?? {
        key,
        label: placed?.item.sr ?? fallback,
        labelEn: placed?.item.en ?? fallback,
        group: placed?.family.sr ?? "Ostalo",
        groupEn: placed?.family.en ?? "Other",
        sort: placed?.sort ?? 1000,
        count: 0,
      };
      current.count += 1;
      typeCounts.set(key, current);
    }
  }
  const colorOptions = [...colorCounts.entries()]
    .map(([slug, count]) => {
      const defined = colors.find((color) => color.slug === slug);
      return { slug, name: defined?.name ?? slug, hex: defined?.hex ?? null, count, sort: defined?.sortOrder ?? 1000 };
    })
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "sr"));
  const sizeOptions = [...sizeCounts.entries()]
    .map(([label, value]) => ({ label, ...value, sort: sizePrefs.find((size) => size.label === label)?.sortOrder ?? 1000 }))
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "sr"));
  const typeOptions = [...typeCounts.values()].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "sr"));
  return {
    products: page.items,
    total: page.total,
    page: page.page,
    pages: page.pages,
    bounds: priceBounds(scoped),
    colorOptions,
    sizeOptions,
    typeOptions,
    catalog,
  };
}
