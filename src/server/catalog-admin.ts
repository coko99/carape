"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { and, asc, eq } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  cartBundleItems,
  cartItems,
  catalogColors,
  categories,
  productCategories,
  productImages,
  products,
  productVariants,
  shoppingListItems,
} from "@/db/schema";
import { foldSearch, typeKey } from "@/lib/search";
import { decodeBasicEntities } from "@/lib/text";
import { requireStaff } from "@/server/admin";

function refresh() {
  revalidatePath("/", "layout");
}

function fail(target: string, message: string): never {
  redirect(`${target}?greska=${encodeURIComponent(message)}`);
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

function money(raw: FormDataEntryValue | null) {
  const text = String(raw ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function text(raw: FormDataEntryValue | null) {
  return String(raw ?? "").trim();
}

async function removeLocalFile(src: string) {
  if (!src.startsWith("/media/") || src.includes("..")) return;
  await fs.unlink(path.join(process.cwd(), "public", src.slice(1))).catch(() => undefined);
}

async function saveUpload(file: FormDataEntryValue | null, folder: string, prefix: string) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 8 * 1024 * 1024) throw new Error("size");
  const filename = `${prefix}-${crypto.randomUUID()}.webp`;
  const directory = path.join(process.cwd(), "public", "media", folder);
  await fs.mkdir(directory, { recursive: true });
  await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(directory, filename));
  return `/media/${folder}/${filename}`;
}

export async function listCatalogAdmin(query: { q?: string; category?: string }) {
  await requireStaff("catalog");
  const db = await requireDb();
  const productRows = await db.select().from(products).orderBy(asc(products.name));
  const variantRows = await db.select().from(productVariants);
  const imageRows = await db.select().from(productImages).orderBy(asc(productImages.sortOrder));
  const links = await db.select().from(productCategories);
  const categoryRows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.nameSr));

  const needle = foldSearch(query.q ?? "");
  const rows = productRows.map((product) => {
    const variants = variantRows.filter((variant) => variant.productId === product.id && variant.status !== "archived");
    const prices = variants.map((variant) => variant.priceMinor);
    const images = imageRows.filter((image) => image.productId === product.id);
    const cover = [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)[0];
    const categoryIds = links.filter((link) => link.productId === product.id).map((link) => link.categoryId);
    const names = categoryRows.filter((category) => categoryIds.includes(category.id)).map((category) => decodeBasicEntities(category.nameSr));
    return {
      id: product.id,
      name: decodeBasicEntities(product.name),
      slug: product.slug,
      status: product.status,
      featured: product.featured,
      image: cover?.src ?? null,
      categoryIds,
      categories: names,
      variantCount: variants.length,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      skus: variants.map((variant) => variant.sku ?? ""),
    };
  });

  return {
    categories: categoryRows.map((category) => ({
      id: category.id,
      name: decodeBasicEntities(category.nameSr),
      parentId: category.parentId,
    })),
    products: rows.filter((product) => {
      if (query.category && !product.categoryIds.includes(query.category)) return false;
      if (!needle) return true;
      const haystack = foldSearch([product.name, product.slug, product.categories.join(" "), product.skus.join(" ")].join(" "));
      return haystack.includes(needle);
    }),
  };
}

export async function getCatalogEditor(id: string) {
  await requireStaff("catalog");
  const db = await requireDb();
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return null;
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));
  const images = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder));
  const links = await db.select().from(productCategories).where(eq(productCategories.productId, id));
  const categoryRows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.nameSr));
  const colors = await db.select().from(catalogColors).orderBy(asc(catalogColors.sortOrder));
  const sizes = [...new Set(variants.map((variant) => variant.size))].sort((a, b) => a.localeCompare(b, "sr"));
  const allSizes = await db.selectDistinct({ size: productVariants.size }).from(productVariants);
  return {
    product: {
      ...product,
      name: decodeBasicEntities(product.name),
      shortDescriptionSr: decodeBasicEntities(product.shortDescriptionSr ?? ""),
      descriptionSr: decodeBasicEntities(product.descriptionSr ?? ""),
    },
    variants: variants.sort((a, b) => a.size.localeCompare(b.size, "sr") || (a.color ?? "").localeCompare(b.color ?? "", "sr")),
    images,
    categoryIds: links.map((link) => link.categoryId),
    categories: categoryRows.map((category) => ({
      id: category.id,
      parentId: category.parentId,
      name: decodeBasicEntities(category.nameSr),
      status: category.status,
    })),
    colors,
    sizes: [...new Set([...sizes, ...allSizes.map((row) => row.size)])].sort((a, b) => a.localeCompare(b, "sr")),
  };
}

export async function createProduct(formData: FormData) {
  await requireStaff("catalog");
  const name = text(formData.get("name"));
  const size = text(formData.get("size"));
  const price = money(formData.get("price"));
  if (!name || !size || price == null) fail("/admin/proizvodi", "Unesite naziv, veličinu i cenu.");
  const db = await requireDb();
  const id = crypto.randomUUID();
  let slug = typeKey(name) || "artikal";
  const [taken] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
  if (taken) slug = `${slug}-${id.slice(0, 6)}`;
  const now = new Date();
  await db.insert(products).values({
    id,
    slug,
    name,
    status: "published",
    featured: false,
    isNew: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(productVariants).values({
    id: crypto.randomUUID(),
    productId: id,
    size,
    color: text(formData.get("color")) || null,
    priceMinor: price,
    regularPriceMinor: price,
    inStock: true,
    stockState: "not_published",
    status: "published",
    createdAt: now,
    updatedAt: now,
  });
  const categoryId = text(formData.get("category"));
  if (categoryId) {
    await db.insert(productCategories).values({ productId: id, categoryId });
  }
  refresh();
  redirect(`/admin/proizvodi/${id}?poruka=${encodeURIComponent("Artikal je dodat.")}`);
}

export async function saveProduct(formData: FormData) {
  await requireStaff("catalog");
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const slug = typeKey(text(formData.get("slug")));
  const back = `/admin/proizvodi/${id}`;
  if (!id || !name || !slug) fail(back, "Naziv i adresa artikla su obavezni.");
  const db = await requireDb();
  const [clash] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
  if (clash && clash.id !== id) fail(back, "Ta adresa artikla već postoji.");
  const status = text(formData.get("status")) === "draft" ? "draft" : "published";
  await db
    .update(products)
    .set({
      name,
      slug,
      shortDescriptionSr: text(formData.get("short")) || null,
      descriptionSr: text(formData.get("description")) || null,
      status,
      featured: formData.get("featured") === "on",
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));
  const categoryIds = formData.getAll("categoryId").map((value) => String(value)).filter(Boolean);
  await db.delete(productCategories).where(eq(productCategories.productId, id));
  if (categoryIds.length) {
    await db.insert(productCategories).values(categoryIds.map((categoryId) => ({ productId: id, categoryId })));
  }
  refresh();
  redirect(`${back}?poruka=${encodeURIComponent("Artikal je sačuvan.")}`);
}

export async function saveVariant(formData: FormData) {
  await requireStaff("catalog");
  const id = text(formData.get("id"));
  const productId = text(formData.get("productId"));
  const back = `/admin/proizvodi/${productId}`;
  const size = text(formData.get("size"));
  const price = money(formData.get("price"));
  if (!id || !productId || !size || price == null) fail(back, "Veličina i cena su obavezni.");
  const regular = money(formData.get("regular"));
  const stockRaw = text(formData.get("stock"));
  const stock = stockRaw === "" ? null : Number(stockRaw);
  if (stock != null && (!Number.isInteger(stock) || stock < 0)) fail(back, "Količina mora biti ceo broj.");
  const db = await requireDb();
  await db
    .update(productVariants)
    .set({
      size,
      color: text(formData.get("color")) || null,
      sku: text(formData.get("sku")) || null,
      priceMinor: price,
      regularPriceMinor: regular != null && regular > price ? regular : price,
      salePriceMinor: null,
      stockQuantity: stock,
      stockState: stock == null ? "not_published" : "counted",
      inStock: stock == null ? formData.get("available") === "on" : stock > 0,
      status: text(formData.get("status")) === "archived" ? "archived" : "published",
      updatedAt: new Date(),
    })
    .where(and(eq(productVariants.id, id), eq(productVariants.productId, productId)));
  refresh();
  redirect(`${back}?poruka=${encodeURIComponent("Varijacija je sačuvana.")}`);
}

export async function addVariant(formData: FormData) {
  await requireStaff("catalog");
  const productId = text(formData.get("productId"));
  const back = `/admin/proizvodi/${productId}`;
  const size = text(formData.get("size"));
  const price = money(formData.get("price"));
  const color = text(formData.get("color")) || null;
  if (!productId || !size || price == null) fail(back, "Za novu varijaciju unesite veličinu i cenu.");
  const db = await requireDb();
  const existing = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  if (existing.some((variant) => variant.size === size && (variant.color ?? null) === color && variant.status !== "archived")) {
    fail(back, "Ta veličina i boja već postoje.");
  }
  const now = new Date();
  await db.insert(productVariants).values({
    id: crypto.randomUUID(),
    productId,
    size,
    color,
    sku: text(formData.get("sku")) || null,
    priceMinor: price,
    regularPriceMinor: price,
    inStock: true,
    stockState: "not_published",
    status: "published",
    createdAt: now,
    updatedAt: now,
  });
  refresh();
  redirect(`${back}?poruka=${encodeURIComponent("Varijacija je dodata.")}`);
}

export async function removeVariant(formData: FormData) {
  await requireStaff("catalog");
  const id = text(formData.get("id"));
  const productId = text(formData.get("productId"));
  const back = `/admin/proizvodi/${productId}`;
  const db = await requireDb();
  const images = await db.select().from(productImages).where(eq(productImages.variantId, id));
  await db.delete(cartItems).where(eq(cartItems.variantId, id));
  await db.delete(cartBundleItems).where(eq(cartBundleItems.variantId, id));
  await db.delete(shoppingListItems).where(eq(shoppingListItems.variantId, id));
  await db.delete(productImages).where(eq(productImages.variantId, id));
  try {
    await db.delete(productVariants).where(and(eq(productVariants.id, id), eq(productVariants.productId, productId)));
    for (const image of images) await removeLocalFile(image.src);
    refresh();
    redirect(`${back}?poruka=${encodeURIComponent("Varijacija je obrisana.")}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await db
      .update(productVariants)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(productVariants.id, id), eq(productVariants.productId, productId)));
    refresh();
    redirect(`${back}?poruka=${encodeURIComponent("Varijacija je sakrivena jer je vezana za porudžbine.")}`);
  }
}

export async function uploadProductImage(formData: FormData) {
  await requireStaff("catalog");
  const productId = text(formData.get("productId"));
  const back = `/admin/proizvodi/${productId}`;
  const db = await requireDb();
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) fail("/admin/proizvodi", "Artikal nije pronađen.");
  let src: string | null = null;
  try {
    src = await saveUpload(formData.get("file"), "products", productId);
  } catch (error) {
    fail(back, error instanceof Error && error.message === "size" ? "Slika je veća od 8 MB." : "Slika nije prepoznata.");
  }
  if (!src) fail(back, "Izaberite sliku.");
  const current = await db.select().from(productImages).where(eq(productImages.productId, productId));
  const variantId = text(formData.get("variantId")) || null;
  await db.insert(productImages).values({
    id: crypto.randomUUID(),
    productId,
    variantId,
    src,
    alt: text(formData.get("alt")) || product.name,
    sortOrder: current.length ? Math.max(...current.map((image) => image.sortOrder)) + 1 : 0,
    isPrimary: current.length === 0,
  });
  refresh();
  redirect(`${back}?poruka=${encodeURIComponent("Slika je dodata.")}`);
}

export async function makePrimaryImage(formData: FormData) {
  await requireStaff("catalog");
  const id = text(formData.get("id"));
  const productId = text(formData.get("productId"));
  const db = await requireDb();
  await db.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
  await db.update(productImages).set({ isPrimary: true, sortOrder: 0 }).where(and(eq(productImages.id, id), eq(productImages.productId, productId)));
  refresh();
  redirect(`/admin/proizvodi/${productId}?poruka=${encodeURIComponent("Glavna slika je promenjena.")}`);
}

export async function removeProductImage(formData: FormData) {
  await requireStaff("catalog");
  const id = text(formData.get("id"));
  const productId = text(formData.get("productId"));
  const db = await requireDb();
  const [image] = await db.select().from(productImages).where(and(eq(productImages.id, id), eq(productImages.productId, productId)));
  if (image) {
    await db.delete(productImages).where(eq(productImages.id, id));
    await removeLocalFile(image.src);
    if (image.isPrimary) {
      const [next] = await db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder));
      if (next) await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id));
    }
  }
  refresh();
  redirect(`/admin/proizvodi/${productId}?poruka=${encodeURIComponent("Slika je obrisana.")}`);
}

export async function listCategoriesAdmin() {
  await requireStaff("catalog");
  const db = await requireDb();
  const categoryRows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.nameSr));
  const links = await db.select().from(productCategories);
  return categoryRows.map((category) => ({
    ...category,
    nameSr: decodeBasicEntities(category.nameSr),
    descriptionSr: decodeBasicEntities(category.descriptionSr ?? ""),
    productCount: links.filter((link) => link.categoryId === category.id).length,
  }));
}

export async function createCategory(formData: FormData) {
  await requireStaff("catalog");
  const name = text(formData.get("name"));
  if (!name) fail("/admin/kategorije", "Unesite naziv kategorije.");
  const db = await requireDb();
  const id = crypto.randomUUID();
  let slug = typeKey(name) || "kategorija";
  const [taken] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
  if (taken) slug = `${slug}-${id.slice(0, 6)}`;
  let image: string | null = null;
  try {
    image = await saveUpload(formData.get("file"), "categories", id);
  } catch {
    fail("/admin/kategorije", "Slika kategorije nije prepoznata.");
  }
  const now = new Date();
  await db.insert(categories).values({
    id,
    slug,
    nameSr: name,
    parentId: text(formData.get("parent")) || null,
    descriptionSr: text(formData.get("description")) || null,
    image,
    sortOrder: Number(formData.get("sort")) || 0,
    status: "published",
    createdAt: now,
    updatedAt: now,
  });
  refresh();
  redirect(`/admin/kategorije?poruka=${encodeURIComponent("Kategorija je dodata.")}`);
}

export async function saveCategory(formData: FormData) {
  await requireStaff("catalog");
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  if (!id || !name) fail("/admin/kategorije", "Naziv kategorije je obavezan.");
  const db = await requireDb();
  let image: string | null | undefined;
  try {
    image = await saveUpload(formData.get("file"), "categories", id);
  } catch {
    fail("/admin/kategorije", "Slika kategorije nije prepoznata.");
  }
  await db
    .update(categories)
    .set({
      nameSr: name,
      descriptionSr: text(formData.get("description")) || null,
      sortOrder: Number(formData.get("sort")) || 0,
      status: text(formData.get("status")) === "draft" ? "draft" : "published",
      ...(image ? { image } : {}),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id));
  refresh();
  redirect(`/admin/kategorije?poruka=${encodeURIComponent("Kategorija je sačuvana.")}`);
}
