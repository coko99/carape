import { notFound } from "next/navigation";
import {
  addVariant,
  getCatalogEditor,
  makePrimaryImage,
  removeProductImage,
  removeVariant,
  saveProduct,
  saveVariant,
  uploadProductImage,
} from "@/server/catalog-admin";

export const instant = false;

function dinar(minor: number) {
  return (minor / 100).toFixed(2);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ greska?: string; poruka?: string }>;
}) {
  const { id } = await params;
  const notice = await searchParams;
  const data = await getCatalogEditor(id);
  if (!data) notFound();
  const { product, variants, images, categories, categoryIds, colors, sizes } = data;
  const roots = categories.filter((category) => !category.parentId);
  const published = variants.filter((variant) => variant.status !== "archived");
  const hidden = variants.filter((variant) => variant.status === "archived");

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <a className="admin-back" href="/admin/proizvodi">Svi proizvodi</a>
          <h1>{product.name}</h1>
          <p>{published.length === 1 ? "1 varijacija" : published.length >= 2 && published.length <= 4 ? `${published.length} varijacije` : `${published.length} varijacija`} · {product.status === "published" ? "objavljen" : "skica"}</p>
        </div>
        <a className="btn ghost" href={`/proizvod/${product.slug}`}>Pogledaj u prodavnici</a>
      </header>
      {notice.greska ? <p className="admin-note bad">{notice.greska}</p> : null}
      {notice.poruka ? <p className="admin-note">{notice.poruka}</p> : null}

      <form className="admin-panel" action={saveProduct}>
        <h2>Artikal</h2>
        <input type="hidden" name="id" value={product.id} />
        <div className="admin-form-grid">
          <label className="field"><span>Naziv</span><input name="name" required defaultValue={product.name} /></label>
          <label className="field"><span>Adresa</span><input name="slug" required defaultValue={product.slug} /></label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={product.status === "draft" ? "draft" : "published"}>
              <option value="published">Objavljen</option>
              <option value="draft">Skica, nije u prodavnici</option>
            </select>
          </label>
          <label className="admin-check"><input type="checkbox" name="featured" defaultChecked={product.featured} /> Istaknut na naslovnoj</label>
        </div>
        <label className="field"><span>Kratak opis</span><textarea name="short" rows={2} defaultValue={product.shortDescriptionSr} /></label>
        <label className="field"><span>Opis</span><textarea name="description" rows={5} defaultValue={product.descriptionSr} /></label>
        <fieldset className="admin-checks">
          <legend>Kategorije</legend>
          {roots.map((root) => {
            const items = categories.filter((category) => category.parentId === root.id);
            return (
              <div key={root.id}>
                <label className="admin-check">
                  <input type="checkbox" name="categoryId" value={root.id} defaultChecked={categoryIds.includes(root.id)} />
                  <strong>{root.name}</strong>
                </label>
                <div className="admin-check-row">
                  {items.map((category) => (
                    <label key={category.id} className="admin-check">
                      <input type="checkbox" name="categoryId" value={category.id} defaultChecked={categoryIds.includes(category.id)} />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </fieldset>
        <button className="btn" type="submit">Sačuvaj artikal</button>
      </form>

      <section className="admin-panel">
        <h2>Slike</h2>
        <ul className="admin-photos">
          {images.map((image) => (
            <li key={image.id}>
              <img src={image.src} alt={image.alt} />
              <small>{image.isPrimary ? "Glavna" : image.variantId ? "Za varijaciju" : "Galerija"}</small>
              <div className="admin-row-actions">
                {image.isPrimary ? null : (
                  <form action={makePrimaryImage}>
                    <input type="hidden" name="id" value={image.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <button type="submit">Glavna</button>
                  </form>
                )}
                <form action={removeProductImage}>
                  <input type="hidden" name="id" value={image.id} />
                  <input type="hidden" name="productId" value={product.id} />
                  <button type="submit">Obriši</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        {images.length === 0 ? <p>Artikal još nema sliku.</p> : null}
        <form className="admin-form-grid" action={uploadProductImage}>
          <input type="hidden" name="productId" value={product.id} />
          <label className="field"><span>Nova slika</span><input name="file" type="file" accept="image/*" required /></label>
          <label className="field">
            <span>Veži za varijaciju</span>
            <select name="variantId" defaultValue="">
              <option value="">Ceo artikal</option>
              {published.map((variant) => (
                <option key={variant.id} value={variant.id}>{variant.size}{variant.color ? ` · ${variant.color}` : ""}</option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">Otpremi sliku</button>
        </form>
      </section>

      <section className="admin-panel">
        <h2>Varijacije i cene</h2>
        <div className="admin-variant-head" aria-hidden="true">
          <span>Veličina</span><span>Boja</span><span>Šifra</span><span>Cena</span><span>Stara cena</span><span>Količina</span><span>Status</span><span></span>
        </div>
        {published.map((variant) => (
          <div key={variant.id} className="admin-variant">
            <form action={saveVariant}>
              <input type="hidden" name="id" value={variant.id} />
              <input type="hidden" name="productId" value={product.id} />
              <input name="size" required defaultValue={variant.size} list="admin-sizes" aria-label="Veličina" />
              <select name="color" defaultValue={variant.color ?? ""} aria-label="Boja">
                <option value="">Bez boje</option>
                {variant.color && !colors.some((color) => color.slug === variant.color) ? <option value={variant.color}>{variant.color}</option> : null}
                {colors.map((color) => <option key={color.id} value={color.slug}>{color.name}</option>)}
              </select>
              <input name="sku" defaultValue={variant.sku ?? ""} aria-label="Šifra" />
              <input name="price" required inputMode="decimal" defaultValue={dinar(variant.priceMinor)} aria-label="Cena u dinarima" />
              <input name="regular" inputMode="decimal" defaultValue={variant.regularPriceMinor > variant.priceMinor ? dinar(variant.regularPriceMinor) : ""} placeholder="ista" aria-label="Stara cena" />
              <input name="stock" type="number" min={0} defaultValue={variant.stockQuantity ?? ""} placeholder="nije uneta" aria-label="Količina" />
              <select name="status" defaultValue="published" aria-label="Status varijacije">
                <option value="published">Aktivna</option>
                <option value="archived">Sakrivena</option>
              </select>
              <div className="admin-row-actions">
                <label className="admin-check"><input type="checkbox" name="available" defaultChecked={variant.inStock} /> Dostupno</label>
                <button className="btn" type="submit">Sačuvaj</button>
              </div>
            </form>
            <form action={removeVariant}>
              <input type="hidden" name="id" value={variant.id} />
              <input type="hidden" name="productId" value={product.id} />
              <button className="admin-text-btn" type="submit">Obriši</button>
            </form>
          </div>
        ))}
        <datalist id="admin-sizes">
          {sizes.map((size) => <option key={size} value={size} />)}
        </datalist>

        <h3>Nova varijacija</h3>
        <form className="admin-variant" action={addVariant}>
          <input type="hidden" name="productId" value={product.id} />
          <input name="size" required placeholder="Veličina" list="admin-sizes" aria-label="Veličina" />
          <select name="color" defaultValue="" aria-label="Boja">
            <option value="">Bez boje</option>
            {colors.map((color) => <option key={color.id} value={color.slug}>{color.name}</option>)}
          </select>
          <input name="sku" placeholder="Šifra" aria-label="Šifra" />
          <input name="price" required inputMode="decimal" placeholder="Cena" aria-label="Cena u dinarima" />
          <button className="btn" type="submit">Dodaj varijaciju</button>
        </form>
        {hidden.length ? (
          <ul className="admin-hidden">
            {hidden.map((variant) => (
              <li key={variant.id}>
                <form action={saveVariant}>
                  <input type="hidden" name="id" value={variant.id} />
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="size" value={variant.size} />
                  <input type="hidden" name="color" value={variant.color ?? ""} />
                  <input type="hidden" name="sku" value={variant.sku ?? ""} />
                  <input type="hidden" name="price" value={dinar(variant.priceMinor)} />
                  <input type="hidden" name="regular" value={variant.regularPriceMinor > variant.priceMinor ? dinar(variant.regularPriceMinor) : ""} />
                  <input type="hidden" name="stock" value={variant.stockQuantity ?? ""} />
                  <input type="hidden" name="status" value="published" />
                  {variant.inStock ? <input type="hidden" name="available" value="on" /> : null}
                  <button className="admin-text-btn" type="submit">Vrati {variant.size}{variant.color ? ` · ${variant.color}` : ""}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
