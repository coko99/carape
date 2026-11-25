import { asc, desc, eq } from "drizzle-orm";

export const instant = false;
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { requireDb } from "@/db";
import { catalogColors, catalogSizes, catalogTypePrefs, categories, productImages, productVariants, products } from "@/db/schema";
import { typeKey } from "@/lib/search";
import { requireStaff } from "@/server/admin";

export default async function Page() {
  await requireStaff("catalog");
  const db = await requireDb();
  const colors = await db.select().from(catalogColors).orderBy(catalogColors.sortOrder);
  const sizes = await db.select().from(catalogSizes);
  const usedSizes = await db.selectDistinct({ label: productVariants.size }).from(productVariants).orderBy(asc(productVariants.size));
  const prefs = await db.select().from(catalogTypePrefs);
  const typeCategories = (await db.select().from(categories)).filter((category) => category.parentId && category.slug !== "najtrazeniji-proizvodi");
  const variants = await db
    .select({ id: productVariants.id, size: productVariants.size, color: productVariants.color, name: products.name })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .orderBy(desc(products.name))
    .limit(40);
  return (
    <div className="grid gap-8">
      <h1 className="text-4xl">Filteri kataloga</h1>
      <p>Boja se dodeljuje postojećoj varijanti. Tip čarape je stvarna kategorija iz kataloga. Veličine dolaze iz varijanti.</p>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        await requireStaff("catalog");
        const name = String(formData.get("name") || "").trim();
        const slug = typeKey(name);
        if (!name || !slug) return;
        const database = await requireDb();
        await database.insert(catalogColors).values({
          id: crypto.randomUUID(),
          name,
          slug,
          hex: String(formData.get("hex") || "") || null,
          sortOrder: Number(formData.get("order") || 0),
          visible: true,
        });
      }}>
        <h2 className="text-2xl">Boja</h2>
        <input name="name" placeholder="Naziv, npr. Crna" required />
        <input name="hex" placeholder="#111111" />
        <input name="order" type="number" defaultValue={0} />
        <button className="btn w-fit" type="submit">Dodaj boju</button>
      </form>
      <ul className="grid gap-2">
        {colors.map((color) => (
          <li key={color.id} className="flex flex-wrap items-center gap-3">
            <span className="inline-block h-6 w-6 rounded-full border border-line" style={{ background: color.hex ?? "transparent" }} />
            {color.name} · {color.slug}
            <form action={async () => {
              "use server";
              await requireStaff("catalog");
              const database = await requireDb();
              await database.update(catalogColors).set({ visible: !color.visible }).where(eq(catalogColors.id, color.id));
            }}>
              <button className="underline" type="submit">{color.visible ? "Sakrij" : "Prikaži"}</button>
            </form>
          </li>
        ))}
      </ul>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        await requireStaff("catalog");
        const database = await requireDb();
        await database.update(productVariants).set({ color: String(formData.get("color") || "") || null, updatedAt: new Date() }).where(eq(productVariants.id, String(formData.get("variant") || "")));
      }}>
        <h2 className="text-2xl">Dodela boje varijanti</h2>
        <select name="variant" required>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.size} · {variant.color ?? "bez boje"}</option>)}
        </select>
        <select name="color"><option value="">Bez boje</option>{colors.map((color) => <option key={color.id} value={color.slug}>{color.name}</option>)}</select>
        <button className="btn w-fit" type="submit">Sačuvaj</button>
      </form>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        await requireStaff("catalog");
        const file = formData.get("file");
        const variantId = String(formData.get("variant") || "");
        if (!(file instanceof File) || !variantId) return;
        const database = await requireDb();
        const [variant] = await database.select().from(productVariants).where(eq(productVariants.id, variantId));
        if (!variant) return;
        const filename = `${variantId}-${crypto.randomUUID()}.webp`;
        const directory = path.join(process.cwd(), "public", "media", "variants");
        await fs.mkdir(directory, { recursive: true });
        await sharp(Buffer.from(await file.arrayBuffer())).webp({ quality: 80 }).toFile(path.join(directory, filename));
        await database.insert(productImages).values({
          id: crypto.randomUUID(),
          productId: variant.productId,
          variantId,
          src: `/media/variants/${filename}`,
          alt: `${variant.size}${variant.color ? `, ${variant.color}` : ""}`,
          sortOrder: 0,
          isPrimary: false,
        });
      }}>
        <h2 className="text-2xl">Fotografija varijante</h2>
        <select name="variant" required>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {variant.size}</option>)}</select>
        <input name="file" type="file" accept="image/*" required />
        <button className="btn w-fit" type="submit">Otpremi</button>
      </form>
      <section>
        <h2 className="text-2xl">Veličine</h2>
        <ul>
          {usedSizes.map((size) => {
            const pref = sizes.find((item) => item.label === size.label);
            const visible = pref?.visible !== false;
            return (
              <li key={size.label}>
                {size.label}
                <form className="inline" action={async () => {
                  "use server";
                  await requireStaff("catalog");
                  const database = await requireDb();
                  await database.insert(catalogSizes).values({ label: size.label, sortOrder: pref?.sortOrder ?? 0, visible: !visible }).onConflictDoUpdate({
                    target: catalogSizes.label,
                    set: { visible: !visible },
                  });
                }}><button className="ml-2 underline" type="submit">{visible ? "Sakrij" : "Prikaži"}</button></form>
              </li>
            );
          })}
        </ul>
        <form className="mt-3 flex gap-2" action={async (formData) => {
          "use server";
          await requireStaff("catalog");
          const database = await requireDb();
          await database.insert(catalogSizes).values({ label: String(formData.get("label") || ""), sortOrder: Number(formData.get("order") || 0), visible: true });
        }}>
          <input name="label" placeholder="Oznaka veličine" required />
          <input name="order" type="number" defaultValue={0} />
          <button className="btn" type="submit">Dodaj</button>
        </form>
      </section>
      <section>
        <h2 className="text-2xl">Tipovi iz kategorija</h2>
        <ul className="grid gap-1">
          {typeCategories.map((category) => {
            const pref = prefs.find((item) => item.categoryId === category.id);
            const visible = pref?.visible !== false;
            return (
              <li key={category.id}>
                {category.nameSr} · {typeKey(category.nameSr)}
                <form className="inline" action={async () => {
                  "use server";
                  await requireStaff("catalog");
                  const database = await requireDb();
                  await database.insert(catalogTypePrefs).values({ categoryId: category.id, visible: !visible, sortOrder: 0 }).onConflictDoUpdate({
                    target: catalogTypePrefs.categoryId,
                    set: { visible: !visible },
                  });
                }}><button className="ml-2 underline" type="submit">{visible ? "Sakrij" : "Prikaži"}</button></form>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
