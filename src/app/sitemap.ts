import type { MetadataRoute } from "next";
import { getCatalog } from "@/server/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const catalog = await getCatalog();
  const staticPaths = ["", "/proizvodi", "/o-nama", "/po-meri", "/kontakt", "/pitanja", "/dostava", "/privatnost", "/uslovi"];
  return [
    ...staticPaths.map((path) => ({ url: `${site}${path || "/"}`, lastModified: new Date() })),
    ...catalog.products.map((product) => ({ url: `${site}/proizvod/${product.slug}`, lastModified: new Date(product.createdAt) })),
    ...catalog.categories.map((category) => ({ url: `${site}/kategorija/${category.slug}` })),
  ];
}
