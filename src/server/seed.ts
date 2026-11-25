import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  catalogColors,
  categories,
  productCategories,
  productImages,
  products,
  productVariants,
  siteSettings,
} from "@/db/schema";
import { loadSourceCatalog } from "@/server/source-catalog";

export const DEFAULT_SETTINGS = {
  shippingFlatMinor: null as number | null,
  freeDeliveryMinor: null as number | null,
  minimumOrderMinor: null as number | null,
  taxRateBps: null as number | null,
  pricesIncludeTax: true,
  bankAccount: null as string | null,
  companyPib: null as string | null,
  companyMb: null as string | null,
  announcementSr: "Online prodavnica je otvorena svakog dana. Cena dostave biće potvrđena pre slanja.",
  announcementEn: "The online shop is open every day. Delivery cost is confirmed before dispatch.",
};

export async function seedCatalog(db: AppDatabase) {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length > 0) return { seeded: false as const };

  const source = loadSourceCatalog();
  const now = new Date();
  const palette = JSON.parse(readFileSync(path.join(process.cwd(), "data", "image-colors.json"), "utf8")).colors as {
    slug: string;
    name: string;
    hex: string;
    sort: number;
  }[];
  await db.insert(catalogColors).values(
    palette.map((color) => ({
      id: `color-${color.slug}`,
      name: color.name,
      slug: color.slug,
      hex: color.hex,
      sortOrder: color.sort,
      visible: true,
    })),
  );

  for (const category of source.categoryRecords) {
    await db.insert(categories).values({
      ...category,
      descriptionEn: null,
      seoTitleSr: category.nameSr,
      seoDescriptionSr: category.descriptionSr,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const product of source.products) {
    await db.insert(products).values({
      id: product.dto.id,
      sourceId: product.sourceId,
      sourceUrl: product.dto.sourceUrl,
      slug: product.dto.slug,
      name: product.dto.name,
      shortDescriptionSr: product.dto.shortDescription || null,
      descriptionSr: product.dto.description || null,
      material: null,
      washing: null,
      status: "published",
      featured: product.dto.featured,
      isNew: false,
      taxClass: "unverified",
      seoTitle: product.dto.name,
      seoDescription: product.dto.shortDescription || product.dto.name,
      createdAt: now,
      updatedAt: now,
    });
    const knownCategories = new Set(source.categoryRecords.map((category) => category.id));
    const categoryIds = [...new Set(product.categoryIds)].filter((categoryId) => knownCategories.has(categoryId));
    if (categoryIds.length) {
      await db.insert(productCategories).values(
        categoryIds.map((categoryId) => ({
          productId: product.dto.id,
          categoryId,
        })),
      );
    }
    await db.insert(productVariants).values(
      product.dto.variants.map((variant) => ({
        id: variant.id,
        productId: product.dto.id,
        sku: null,
        size: variant.size,
        color: variant.color,
        priceMinor: variant.priceMinor,
        regularPriceMinor: variant.regularPriceMinor,
        salePriceMinor: null,
        stockQuantity: null,
        reservedQuantity: 0,
        lowStockThreshold: 5,
        inStock: variant.inStock,
        stockState: "not_published",
        status: "published",
        createdAt: now,
        updatedAt: now,
      })),
    );
    if (product.gallery.length) {
      await db.insert(productImages).values(
        product.gallery.map((image, index) => ({
          id: `${product.dto.id}-image-${index + 1}`,
          productId: product.dto.id,
          src: image.src,
          sourceSrc: image.sourceSrc,
          alt: image.alt,
          sortOrder: index,
          isPrimary: index === 0,
        })),
      );
    }
  }

  await db.insert(siteSettings).values({
    key: "store",
    value: JSON.stringify(DEFAULT_SETTINGS),
    updatedAt: now,
  }).onConflictDoNothing();
  await db.insert(siteSettings).values({
    key: "order_seq",
    value: "1000",
    updatedAt: now,
  }).onConflictDoNothing();

  return { seeded: true as const, products: source.products.length, categories: source.categoryRecords.length };
}

export async function readSettings(db: Pick<AppDatabase, "select">) {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, "store"));
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) } as typeof DEFAULT_SETTINGS;
}
