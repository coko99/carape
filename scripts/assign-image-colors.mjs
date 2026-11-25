import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = process.cwd();
const data = JSON.parse(readFileSync(path.join(root, "data", "image-colors.json"), "utf8"));
const onDisk = new Set(readdirSync(path.join(root, "public", "media", "products")).filter((file) => file.endsWith(".webp")));
const mapped = Object.keys(data.files);
const missing = [...onDisk].filter((file) => !data.files[file]);
const extra = mapped.filter((file) => file.endsWith(".webp") && !onDisk.has(file));
if (missing.length || extra.length) {
  console.error("file mismatch", { missing, extra });
  process.exit(1);
}

const db = new PGlite(path.join(root, ".data", "pglite"));
for (const color of data.colors) {
  await db.query(
    `insert into catalog_colors (id, name, slug, hex, sort_order, visible)
     values ($1, $2, $3, $4, $5, true)
     on conflict (slug) do update set name = excluded.name, hex = excluded.hex, sort_order = excluded.sort_order, visible = true`,
    [`color-${color.slug}`, color.name, color.slug, color.hex, color.sort],
  );
}

const images = await db.query(`select product_id, src, is_primary, sort_order from product_images order by sort_order asc`);
const primary = new Map();
for (const row of images.rows) {
  const current = primary.get(row.product_id);
  if (!current || row.is_primary || (!current.is_primary && row.sort_order < current.sort_order)) primary.set(row.product_id, row);
}

const counts = {};
let products = 0;
let variants = 0;
const unseen = [];
for (const [productId, image] of primary) {
  const file = String(image.src).split("/").pop();
  const color = data.files[file];
  if (!color) {
    unseen.push(file);
    continue;
  }
  const updated = await db.query(`update product_variants set color = $1, updated_at = now() where product_id = $2`, [color, productId]);
  products += 1;
  variants += updated.affectedRows ?? updated.rows?.length ?? 0;
  counts[color] = (counts[color] ?? 0) + 1;
}

const check = await db.query(`select color, count(distinct product_id)::int as products from product_variants where color is not null group by color order by color`);
console.log(JSON.stringify({ products, unseen, counts, check: check.rows }, null, 2));
await db.close();
