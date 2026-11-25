import { readFileSync } from "node:fs";
import path from "node:path";
import type { CategoryDTO, ProductDTO } from "@/lib/catalog";
import { canonicalTypeKey, isTypeCategory, typeKey } from "@/lib/search";
import { decodeBasicEntities } from "@/lib/text";

type SourceCategory = {
  sourceId: number;
  sourceUrl: string;
  name: string;
  slug: string;
  parentSourceId: number;
  descriptionText: string;
  image: string | null;
};

type SourceProduct = {
  sourceId: number;
  sourceUrl: string;
  name: string;
  slug: string;
  shortDescriptionText: string;
  descriptionText: string;
  priceMinor: number | null;
  regularPriceMinor: number | null;
  isInStock: boolean;
  images: { src: string; alt: string }[];
  categorySourceIds: number[];
  sizes: { slug: string; label: string }[];
};

type ImageRecord = {
  slug: string;
  index: number;
  sourceSrc: string;
  file?: string;
  ok: boolean;
};

type ImageColorFile = { files: Record<string, string> };

const imageColors = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "image-colors.json"), "utf8"),
) as ImageColorFile;

function colorForImage(src: string | undefined) {
  if (!src) return null;
  const file = src.split("/").pop() ?? "";
  return imageColors.files[file] ?? null;
}

const AUDIENCE: Record<string, string> = {
  "muski-program": "men",
  "zenski-pamucni-program": "women",
  "deciji-program": "children",
  "program-za-bebe": "baby",
  "sportski-program": "sport",
  "medicinski-program": "medical",
};

const ENGLISH: Record<string, string> = {
  "muski-program": "Men",
  "zenski-pamucni-program": "Women",
  "deciji-program": "Children",
  "program-za-bebe": "Baby",
  "sportski-program": "Sport",
  "medicinski-program": "Medical",
  "najtrazeniji-proizvodi": "Bestsellers",
  "biciklisticka-carapa": "Cycling socks",
  dokolenica: "Knee-highs",
  "dokolenica-deciji-program": "Knee-highs",
  "dokolenica-program-za-bebe": "Knee-highs",
  "dokolenica-muski-program": "Knee-highs",
  "fitnes-carapa": "Fitness socks",
  "folklorna-dokolenica": "Folk knee-highs",
  "klasicna-carapa": "Classic socks",
  "klasicna-carapa-bez-gumice": "Classic socks, soft cuff",
  "klasicna-sportska": "Classic sport socks",
  "lovacka-termo-carapa": "Hunting thermal socks",
  "lovacka-termo-dokolenica": "Hunting thermal knee-highs",
  nadkolenica: "Over-the-knee socks",
  nazuvice: "Ankle socks",
  "nazuvica-muski-program": "Ankle socks",
  "odbojkaska-dokolenica": "Volleyball knee-highs",
  "m-sport-punija": "Ski thermal socks",
  sokna: "Socks",
  "sokna-deciji-program": "Socks",
  sokne: "Socks",
  "sport-kids": "Sport kids",
  "m-sport-polutermo-duza": "Mid-thermal sport socks",
  stucna: "Shin socks",
  "termo-bez-gumice": "Thermal socks, soft cuff",
};

const ROOT_ORDER = [
  "zenski-pamucni-program",
  "muski-program",
  "sportski-program",
  "deciji-program",
  "program-za-bebe",
  "medicinski-program",
  "najtrazeniji-proizvodi",
];

const FEATURED_NAMES = new Set([
  "crna sa jezičkom i silikonom",
  "beli karnerić",
  "ananas plava",
  "mediko čarapa bez stezanja-teget",
]);

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), "data/migration", file), "utf8")) as T;
}

export function categoryId(sourceId: number) {
  return `src-category-${sourceId}`;
}

export function productId(sourceId: number) {
  return `src-product-${sourceId}`;
}

export function variantId(sourceId: number, size: string) {
  return `src-variant-${sourceId}-${size}`;
}

export function loadSourceCatalog() {
  const sourceCategories = readJson<SourceCategory[]>("categories.json");
  const sourceProducts = readJson<SourceProduct[]>("products.json");
  const images = readJson<ImageRecord[]>("images.json");
  const imageByKey = new Map(images.filter((image) => image.ok && image.file).map((image) => [`${image.slug}:${image.index}`, image.file!]));

  const bySource = new Map(sourceCategories.map((category) => [category.sourceId, category]));
  const ordered = [...sourceCategories].sort((a, b) => {
    const ar = ROOT_ORDER.indexOf(a.slug);
    const br = ROOT_ORDER.indexOf(b.slug);
    if (a.parentSourceId === 0 && b.parentSourceId === 0) return (ar < 0 ? 99 : ar) - (br < 0 ? 99 : br);
    return a.name.localeCompare(b.name, "sr");
  });

  const categoryRecords = ordered.map((category, index) => ({
    id: categoryId(category.sourceId),
    sourceId: category.sourceId,
    sourceUrl: category.sourceUrl,
    parentId: category.parentSourceId ? categoryId(category.parentSourceId) : null,
    slug: category.slug,
    nameSr: category.name,
    nameEn: ENGLISH[category.slug] ?? null,
    descriptionSr: category.descriptionText || null,
    image: null as string | null,
    sortOrder: index,
    status: "published",
  }));

  const rootSlug = (sourceId: number) => {
    let current = bySource.get(sourceId);
    const guard = new Set<number>();
    while (current && current.parentSourceId && !guard.has(current.sourceId)) {
      guard.add(current.sourceId);
      current = bySource.get(current.parentSourceId);
    }
    return current?.slug ?? null;
  };

  const products = sourceProducts.map((product) => {
    const price = product.priceMinor ?? product.regularPriceMinor;
    if (price == null) return null;
    const sizes = product.sizes.length ? product.sizes : [{ slug: "unspecified", label: "—" }];
    const categorySlugs = product.categorySourceIds
      .map((id) => bySource.get(id)?.slug)
      .filter((slug): slug is string => Boolean(slug));
    const categoryNames = product.categorySourceIds
      .map((id) => bySource.get(id)?.name)
      .filter((name): name is string => Boolean(name));
    const audiences = [
      ...new Set(
        product.categorySourceIds
          .map((id) => rootSlug(id))
          .map((slug) => (slug ? AUDIENCE[slug] : undefined))
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const gallery = product.images.map((image, index) => {
      const local = imageByKey.get(`${product.slug}:${index}`);
      const primaryCategory = categoryNames[0] ?? "čarape";
      return {
        src: local ?? image.src,
        sourceSrc: image.src,
        alt: image.alt?.trim() || `${product.name}, ${primaryCategory}, ŽA-JO KOMERC`,
      };
    });
    const featured =
      categorySlugs.includes("najtrazeniji-proizvodi") ||
      FEATURED_NAMES.has(product.name.toLocaleLowerCase("sr"));
    const variants = sizes.map((size) => ({
      id: variantId(product.sourceId, size.slug || size.label),
      size: size.label,
      color: colorForImage(gallery[0]?.src),
      image: null,
      sku: null,
      priceMinor: price,
      regularPriceMinor: product.regularPriceMinor ?? price,
      inStock: product.isInStock,
      stockQuantity: null,
      reservedQuantity: 0,
      stockState: "not_published",
    }));
    const dto: ProductDTO = {
      id: productId(product.sourceId),
      slug: product.slug,
      name: decodeBasicEntities(product.name),
      shortDescription: decodeBasicEntities(product.shortDescriptionText),
      description: decodeBasicEntities(product.descriptionText),
      material: null,
      washing: null,
      featured,
      isNew: false,
      sourceUrl: product.sourceUrl,
      priceMinor: price,
      regularPriceMinor: product.regularPriceMinor ?? price,
      onSale: false,
      inStock: product.isInStock,
      stockKnown: false,
      images: gallery.map(({ src, alt }) => ({ src, alt })),
      categorySlugs,
      categoryNames,
      typeKeys: [...new Set(categorySlugs.filter(isTypeCategory).map((slug) => canonicalTypeKey(typeKey(categoryNames[categorySlugs.indexOf(slug)] ?? slug))))],
      audiences,
      variants,
      createdAt: "2026-08-10T09:17:21.000Z",
    };
    return {
      dto,
      gallery,
      categoryIds: product.categorySourceIds.map(categoryId),
      sourceId: product.sourceId,
    };
  }).filter((product): product is NonNullable<typeof product> => product != null);

  const firstImage = new Map<string, string>();
  for (const product of products) {
    const image = product.gallery[0]?.src;
    if (!image) continue;
    for (const slug of product.dto.categorySlugs) {
      if (!firstImage.has(slug)) firstImage.set(slug, image);
    }
  }
  for (const category of categoryRecords) category.image = firstImage.get(category.slug) ?? null;

  const counts = new Map<string, number>();
  for (const product of products) {
    for (const slug of product.dto.categorySlugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const categoryDtos: CategoryDTO[] = categoryRecords.map((category) => ({
    id: category.id,
    slug: category.slug,
    nameSr: category.nameSr,
    nameEn: category.nameEn,
    parentSlug: category.parentId
      ? (categoryRecords.find((item) => item.id === category.parentId)?.slug ?? null)
      : null,
    description: category.descriptionSr ?? "",
    image: category.image,
    sourceUrl: category.sourceUrl,
    sortOrder: category.sortOrder,
    productCount: counts.get(category.slug) ?? 0,
  }));

  return { categoryRecords, categoryDtos, products };
}
