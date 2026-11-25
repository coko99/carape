const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ж: "z", з: "z", и: "i", ј: "j",
  к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t",
  ћ: "c", у: "u", ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s",
  đ: "dj",
};

export function foldSearch(value: string) {
  const lower = value.toLocaleLowerCase("sr");
  let folded = "";
  for (const char of lower) folded += CYRILLIC[char] ?? char;
  return folded.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function typeKey(name: string) {
  return foldSearch(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const TYPE_ALIASES: Record<string, string> = {
  sokna: "sokne",
  nazuvica: "nazuvice",
};

export function canonicalTypeKey(key: string) {
  return TYPE_ALIASES[key] ?? key;
}

export type SearchVariant = {
  id: string;
  size: string;
  color: string | null;
  sku: string | null;
  priceMinor: number;
  inStock: boolean;
};

export type SearchProduct = {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  categoryNames: string[];
  categorySlugs: string[];
  typeKeys: string[];
  priceMinor: number;
  onSale: boolean;
  featured: boolean;
  isNew: boolean;
  audiences: string[];
  createdAt: string;
  variants: SearchVariant[];
};

export type SearchQuery = {
  category?: string;
  audience?: string;
  q?: string;
  colors?: string[];
  sizes?: string[];
  types?: string[];
  min?: number;
  max?: number;
  sale?: boolean;
  featured?: boolean;
  isNew?: boolean;
  available?: boolean;
  availableSizes?: boolean;
  sort?: "featured" | "newest" | "price-asc" | "price-desc" | "name" | "name-desc" | "popular";
  page?: number;
};

const ROOTS = new Set([
  "muski-program",
  "zenski-pamucni-program",
  "deciji-program",
  "program-za-bebe",
  "sportski-program",
  "medicinski-program",
  "najtrazeniji-proizvodi",
]);

export function isTypeCategory(slug: string) {
  return !ROOTS.has(slug);
}

function haystack(product: SearchProduct) {
  return foldSearch(
    [
      product.name,
      product.shortDescription,
      product.description,
      product.categoryNames.join(" "),
      product.variants.map((variant) => [variant.size, variant.color, variant.sku].filter(Boolean).join(" ")).join(" "),
    ].join(" "),
  );
}

export function variantFits(
  variant: SearchVariant,
  query: SearchQuery,
) {
  if (query.colors?.length && !query.colors.includes(variant.color ?? "")) return false;
  if (query.sizes?.length && !query.sizes.includes(variant.size)) return false;
  if (query.availableSizes && !variant.inStock) return false;
  if (query.min != null && variant.priceMinor < query.min) return false;
  if (query.max != null && variant.priceMinor > query.max) return false;
  return true;
}

export function matchesProduct(product: SearchProduct, query: SearchQuery) {
  if (query.category && !product.categorySlugs.includes(query.category)) return false;
  if (query.audience && !product.audiences.includes(query.audience)) return false;
  if (query.sale && !product.onSale) return false;
  if (query.featured && !product.featured) return false;
  if (query.isNew && !product.isNew) return false;
  if (query.available && !product.variants.some((variant) => variant.inStock)) return false;
  if (query.types?.length && !query.types.some((key) => product.typeKeys.includes(canonicalTypeKey(key)))) return false;
  const variantConstrained = Boolean(
    query.colors?.length || query.sizes?.length || query.availableSizes || query.min != null || query.max != null,
  );
  if (variantConstrained && !product.variants.some((variant) => variantFits(variant, query))) return false;
  const text = query.q?.trim() ?? "";
  if (text) {
    const folded = haystack(product);
    const tokens = foldSearch(text).split(/\s+/).filter(Boolean);
    if (!tokens.every((token) => folded.includes(token))) return false;
  }
  return true;
}

export function sortProducts<T extends SearchProduct>(products: T[], sort: SearchQuery["sort"], sales: Map<string, number> = new Map()) {
  const mode = sort ?? "featured";
  return [...products].sort((a, b) => {
    if (mode === "price-asc") return a.priceMinor - b.priceMinor || a.name.localeCompare(b.name, "sr");
    if (mode === "price-desc") return b.priceMinor - a.priceMinor || a.name.localeCompare(b.name, "sr");
    if (mode === "name") return a.name.localeCompare(b.name, "sr");
    if (mode === "name-desc") return b.name.localeCompare(a.name, "sr");
    if (mode === "newest") return b.createdAt.localeCompare(a.createdAt);
    if (mode === "popular") return (sales.get(b.id) ?? 0) - (sales.get(a.id) ?? 0) || a.name.localeCompare(b.name, "sr");
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.name.localeCompare(b.name, "sr");
  });
}

export function catalogHref(path: string, query: SearchQuery, patch: Partial<SearchQuery> = {}) {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  for (const color of next.colors ?? []) params.append("boja", color);
  for (const size of next.sizes ?? []) params.append("velicina", size);
  for (const type of next.types ?? []) params.append("tip", type);
  if (next.audience) params.set("audience", next.audience);
  if (next.min != null) params.set("min", String(Math.round(next.min / 100)));
  if (next.max != null) params.set("max", String(Math.round(next.max / 100)));
  if (next.availableSizes) params.set("dostupno", "1");
  if (next.available) params.set("available", "1");
  if (next.sort && next.sort !== "featured") params.set("sort", next.sort);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const value = params.toString();
  return value ? `${path}?${value}` : path;
}

export function paginate<T>(items: T[], page = 1, pageSize = 24) {
  const current = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const start = (current - 1) * pageSize;
  return {
    page: current,
    pageSize,
    total: items.length,
    pages: Math.max(1, Math.ceil(items.length / pageSize)),
    items: items.slice(start, start + pageSize),
  };
}
