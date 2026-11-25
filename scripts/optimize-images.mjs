import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const products = JSON.parse(
  fs.readFileSync("E:/sajtovi/_carape_audit/catalog/products.json", "utf8"),
);
const originals = "E:/sajtovi/_carape_audit/originals";
const outDir = "E:/sajtovi/carape/public/media/products";
fs.mkdirSync(outDir, { recursive: true });

const manifest = [];
for (const product of products) {
  for (let index = 0; index < product.images.length; index++) {
    const image = product.images[index];
    const ext = path.extname(new URL(image.src).pathname) || ".jpg";
    const sourceFile = path.join(originals, `${product.slug}-${index + 1}${ext.toLowerCase()}`);
    const filename = `${product.slug}-${index + 1}.webp`;
    const dest = path.join(outDir, filename);
    if (!fs.existsSync(sourceFile)) {
      manifest.push({ slug: product.slug, index, src: image.src, ok: false, reason: "missing_original" });
      continue;
    }
    const result = await sharp(sourceFile)
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 76 })
      .toFile(dest);
    manifest.push({
      slug: product.slug,
      index,
      sourceSrc: image.src,
      file: `/media/products/${filename}`,
      width: result.width,
      height: result.height,
      bytes: result.size,
      ok: true,
    });
  }
}
fs.mkdirSync("E:/sajtovi/carape/data/migration", { recursive: true });
fs.copyFileSync(
  "E:/sajtovi/_carape_audit/catalog/products.json",
  "E:/sajtovi/carape/data/migration/products.json",
);
fs.copyFileSync(
  "E:/sajtovi/_carape_audit/catalog/categories.json",
  "E:/sajtovi/carape/data/migration/categories.json",
);
fs.copyFileSync(
  "E:/sajtovi/_carape_audit/catalog/pages.json",
  "E:/sajtovi/carape/data/migration/pages.json",
);
fs.writeFileSync("E:/sajtovi/carape/data/migration/images.json", JSON.stringify(manifest, null, 2));
const failed = manifest.filter((item) => !item.ok).length;
const bytes = manifest.reduce((sum, item) => sum + (item.bytes || 0), 0);
console.log(JSON.stringify({ images: manifest.length, failed, bytes }, null, 2));
