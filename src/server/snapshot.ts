import { loadSourceCatalog } from "@/server/source-catalog";

export async function loadSnapshotCatalog() {
  const source = loadSourceCatalog();
  return {
    products: source.products.map((product) => product.dto),
    categories: source.categoryDtos,
  };
}
