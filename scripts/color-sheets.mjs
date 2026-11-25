import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const dir = path.join(root, "public", "media", "products");
const out = path.join(root, ".data", "color-sheets");
await mkdir(out, { recursive: true });

const files = (await readdir(dir)).filter((file) => file.endsWith(".webp")).sort();
const cols = 4;
const rows = 4;
const cell = 280;
const label = 36;
const per = cols * rows;

for (let page = 0; page < Math.ceil(files.length / per); page += 1) {
  const slice = files.slice(page * per, page * per + per);
  const tiles = await Promise.all(
    slice.map(async (file) => {
      const image = await sharp(path.join(dir, file))
        .resize(cell, cell, { fit: "cover" })
        .png()
        .toBuffer();
      const caption = await sharp({
        create: { width: cell, height: label, channels: 3, background: "#111111" },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${cell}" height="${label}"><text x="8" y="23" fill="white" font-size="13" font-family="sans-serif">${file.replace(".webp", "")}</text></svg>`,
            ),
          },
        ])
        .png()
        .toBuffer();
      return sharp({
        create: { width: cell, height: cell + label, channels: 3, background: "#ffffff" },
      })
        .composite([
          { input: image, top: 0, left: 0 },
          { input: caption, top: cell, left: 0 },
        ])
        .png()
        .toBuffer();
    }),
  );
  const composites = tiles.map((input, index) => ({
    input,
    left: (index % cols) * cell,
    top: Math.floor(index / cols) * (cell + label),
  }));
  await sharp({
    create: {
      width: cols * cell,
      height: rows * (cell + label),
      channels: 3,
      background: "#f4f4f4",
    },
  })
    .composite(composites)
    .jpeg({ quality: 80 })
    .toFile(path.join(out, `sheet-${String(page + 1).padStart(2, "0")}.jpg`));
}

console.log(`sheets ${Math.ceil(files.length / per)} files ${files.length}`);
