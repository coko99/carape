import { matchesProduct, sortProducts } from "@/lib/search";

export type VariantDTO = {
  id: string;
  size: string;
  color: string | null;
  image: string | null;
  sku: string | null;
  priceMinor: number;
  regularPriceMinor: number;
  inStock: boolean;
  stockQuantity: number | null;
  reservedQuantity: number;
  stockState: string;
};

export type ProductDTO = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  material: string | null;
  washing: string | null;
  featured: boolean;
  isNew: boolean;
  sourceUrl: string | null;
  priceMinor: number;
  regularPriceMinor: number;
  onSale: boolean;
  inStock: boolean;
  stockKnown: boolean;
  images: { src: string; alt: string }[];
  categorySlugs: string[];
  categoryNames: string[];
  typeKeys: string[];
  audiences: string[];
  variants: VariantDTO[];
  createdAt: string;
};

export type CategoryDTO = {
  id: string;
  slug: string;
  nameSr: string;
  nameEn: string | null;
  parentSlug: string | null;
  description: string;
  image: string | null;
  sourceUrl: string | null;
  sortOrder: number;
  productCount: number;
};

export type CatalogQuery = {
  category?: string;
  audience?: string;
  size?: string;
  sizes?: string[];
  colors?: string[];
  types?: string[];
  q?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "name" | "name-desc" | "featured" | "popular";
  sale?: boolean;
  featured?: boolean;
  isNew?: boolean;
  available?: boolean;
  availableSizes?: boolean;
  min?: number;
  max?: number;
  page?: number;
};

export function filterCatalog(products: ProductDTO[], query: CatalogQuery, sales: Map<string, number> = new Map()) {
  const sizes = query.sizes?.length ? query.sizes : query.size ? [query.size] : undefined;
  const normalized = { ...query, sizes };
  const items = products.filter((product) => matchesProduct(product, normalized));
  return sortProducts(items, query.sort, sales);
}

export function categoryLabel(
  category: { nameSr: string; nameEn: string | null },
  locale: string,
) {
  return locale === "en" && category.nameEn ? category.nameEn : category.nameSr;
}

export function priceBounds(products: ProductDTO[]) {
  const prices = products.map((product) => product.priceMinor);
  return {
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
  };
}
