import { parseQuery } from "@/app/[locale]/proizvodi/page";
import { searchCatalog } from "@/server/shop-search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    raw[key] = values.length > 1 ? values : values[0];
  }
  const result = await searchCatalog({ ...parseQuery(raw), page: 1 });
  return Response.json({
    total: result.total,
    suggestions: result.products.slice(0, 6).map((product) => ({
      name: product.name,
      slug: product.slug,
      priceMinor: product.priceMinor,
      image: product.images[0]?.src ?? null,
    })),
  });
}
