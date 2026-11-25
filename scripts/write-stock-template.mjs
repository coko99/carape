import fs from "node:fs";

const products = JSON.parse(fs.readFileSync("data/migration/products.json", "utf8"));
const rows = [["source_id", "slug", "name", "size", "sku", "stock_quantity", "material", "washing", "source_url"]];
for (const product of products) {
  const sizes = product.sizes?.length ? product.sizes : [{ label: "" }];
  for (const size of sizes) {
    rows.push([
      product.sourceId,
      product.slug,
      product.name,
      size.label || "",
      "",
      "",
      "",
      "",
      product.sourceUrl,
    ]);
  }
}
const csv = rows
  .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
  .join("\n");
fs.mkdirSync("public/templates", { recursive: true });
fs.writeFileSync("public/templates/stock-import-template.csv", `${csv}\n`);
console.log(JSON.stringify({ products: products.length, rows: rows.length - 1 }));
