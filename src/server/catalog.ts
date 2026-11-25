import { asc, eq } from "drizzle-orm";
import { getDb, resetDb } from "@/db";
import {
  categories,
  productCategories,
  productImages,
  products,
  productVariants,
} from "@/db/schema";
import type { CategoryDTO, ProductDTO } from "@/lib/catalog";
import { canonicalTypeKey, isTypeCategory, typeKey } from "@/lib/search";
import { decodeBasicEntities } from "@/lib/text";

const AUDIENCE: Record<string, string> = {
  "muski-program": "men",
  "zenski-pamucni-program": "women",
  "deciji-program": "children",
  "program-za-bebe": "baby",
  "sportski-program": "sport",
  "medicinski-program": "medical",
};

export async function loadDatabaseCatalog(): Promise<{
  products: ProductDTO[];
  categories: CategoryDTO[];
} | null> {
  const db = await getDb();
  if (!db) return null;

  const categoryRows = await db.select().from(categories).orderBy(asc(categories.sortOrder));
  if (categoryRows.length === 0) return null;
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.status, "published"));
  if (productRows.length === 0) return null;

  const variantRows = await db.select().from(productVariants).where(eq(productVariants.status, "published"));
  const imageRows = await db.select().from(productImages).orderBy(asc(productImages.sortOrder));
  const links = await db.select().from(productCategories);

  const byParent = new Map(categoryRows.map((row) => [row.id, row]));
  const slugsByProduct = new Map<string, string[]>();
  const namesByProduct = new Map<string, string[]>();
  for (const link of links) {
    const category = byParent.get(link.categoryId);
    if (!category) continue;
    slugsByProduct.set(link.productId, [...(slugsByProduct.get(link.productId) ?? []), category.slug]);
    namesByProduct.set(link.productId, [...(namesByProduct.get(link.productId) ?? []), decodeBasicEntities(category.nameSr)]);
  }

  const variantsByProduct = new Map<string, typeof variantRows>();
  for (const variant of variantRows) {
    variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) ?? []), variant]);
  }
  const imagesByProduct = new Map<string, typeof imageRows>();
  for (const image of imageRows) {
    imagesByProduct.set(image.productId, [...(imagesByProduct.get(image.productId) ?? []), image]);
  }

  const productDtos: ProductDTO[] = productRows.map((product) => {
    const productImages = imagesByProduct.get(product.id) ?? [];
    const variants = (variantsByProduct.get(product.id) ?? []).map((variant) => {
      const discounted = variant.salePriceMinor != null ? Math.min(variant.priceMinor, variant.salePriceMinor) : variant.priceMinor;
      const counted = variant.stockQuantity == null ? variant.inStock : variant.inStock && variant.stockQuantity - variant.reservedQuantity > 0;
      return {
      id: variant.id,
      size: variant.size,
      color: variant.color,
      image: productImages.find((image) => image.variantId === variant.id)?.src ?? null,
      sku: variant.sku,
      priceMinor: discounted,
      regularPriceMinor: variant.regularPriceMinor,
      inStock: counted,
      stockQuantity: variant.stockQuantity,
      reservedQuantity: variant.reservedQuantity,
      stockState: variant.stockState,
    };
    });
    const prices = variants.map((variant) => variant.priceMinor);
    const regulars = variants.map((variant) => variant.regularPriceMinor);
    const priceMinor = prices.length ? Math.min(...prices) : 0;
    const regularPriceMinor = regulars.length ? Math.min(...regulars) : priceMinor;
    const categorySlugs = slugsByProduct.get(product.id) ?? [];
    const audiences = [
      ...new Set(
        categorySlugs
          .map((slug) => {
            const row = categoryRows.find((category) => category.slug === slug);
            let current = row;
            while (current?.parentId) current = byParent.get(current.parentId);
            return current ? AUDIENCE[current.slug] : undefined;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const images = (imagesByProduct.get(product.id) ?? []).map((image) => ({
      src: image.src,
      alt: image.alt,
    }));
    return {
      id: product.id,
      slug: product.slug,
      name: decodeBasicEntities(product.name),
      shortDescription: decodeBasicEntities(product.shortDescriptionSr ?? ""),
      description: decodeBasicEntities(product.descriptionSr ?? ""),
      material: product.material,
      washing: product.washing,
      featured: product.featured,
      isNew: product.isNew,
      sourceUrl: product.sourceUrl,
      priceMinor,
      regularPriceMinor,
      onSale: priceMinor < regularPriceMinor,
      inStock: variants.some((variant) => variant.inStock),
      stockKnown: variants.some((variant) => variant.stockQuantity != null),
      images,
      categorySlugs,
      categoryNames: namesByProduct.get(product.id) ?? [],
      typeKeys: [
        ...new Set(
          categorySlugs.filter(isTypeCategory).map((slug) => {
            const row = categoryRows.find((category) => category.slug === slug);
            return row ? canonicalTypeKey(typeKey(decodeBasicEntities(row.nameSr))) : "";
          }).filter(Boolean),
        ),
      ],
      audiences,
      variants,
      createdAt: product.createdAt.toISOString(),
    };
  });

  const counts = new Map<string, number>();
  for (const product of productDtos) {
    for (const slug of product.categorySlugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  const categoryDtos: CategoryDTO[] = categoryRows
    .filter((row) => row.status === "published")
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      nameSr: decodeBasicEntities(row.nameSr),
      nameEn: row.nameEn,
      parentSlug: row.parentId ? (byParent.get(row.parentId)?.slug ?? null) : null,
      description: decodeBasicEntities(row.descriptionSr ?? ""),
      image: row.image,
      sourceUrl: row.sourceUrl,
      sortOrder: row.sortOrder,
      productCount: counts.get(row.slug) ?? 0,
    }));

  return { products: productDtos, categories: categoryDtos };
}

export async function getCatalog() {
  try {
    const databaseCatalog = await loadDatabaseCatalog();
    if (databaseCatalog) return { source: "database" as const, commerce: true, ...databaseCatalog };
  } catch (error) {
    console.error("Catalog database read failed.", error);
    resetDb();
    try {
      const retried = await loadDatabaseCatalog();
      if (retried) return { source: "database" as const, commerce: true, ...retried };
    } catch (retryError) {
      console.error("Catalog database retry failed.", retryError);
    }
  }
  const { loadSnapshotCatalog } = await import("@/server/snapshot");
  const snapshot = await loadSnapshotCatalog();
  return { source: "snapshot" as const, commerce: false, ...snapshot };
}

export async function getProduct(slug: string) {
  const catalog = await getCatalog();
  return {
    source: catalog.source,
    commerce: catalog.commerce,
    product: catalog.products.find((product) => product.slug === slug) ?? null,
    categories: catalog.categories,
  };
}

export async function getCategory(slug: string) {
  const catalog = await getCatalog();
  return {
    ...catalog,
    category: catalog.categories.find((category) => category.slug === slug) ?? null,
  };
}
