import { formatRsd } from "@/lib/commerce";
import { createProduct, listCatalogAdmin } from "@/server/catalog-admin";

export const instant = false;

function priceLabel(min: number | null, max: number | null) {
  if (min == null || max == null) return "Nema cene";
  if (min === max) return formatRsd(min);
  return `${formatRsd(min)} – ${formatRsd(max)}`;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; kategorija?: string; greska?: string }> }) {
  const query = await searchParams;
  const data = await listCatalogAdmin({ q: query.q, category: query.kategorija });
  const roots = data.categories.filter((category) => !category.parentId);
  const children = (parentId: string) => data.categories.filter((category) => category.parentId === parentId);

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <h1>Proizvodi</h1>
          <p>{data.products.length} artikala. Otvorite artikal da menjate slike, cenu, kategorije i varijacije.</p>
        </div>
      </header>
      {query.greska ? <p className="admin-note bad">{query.greska}</p> : null}

      <form className="admin-toolbar" method="get">
        <label className="field">
          <span>Pretraga</span>
          <input name="q" defaultValue={query.q ?? ""} placeholder="Naziv, šifra ili kategorija" />
        </label>
        <label className="field">
          <span>Kategorija</span>
          <select name="kategorija" defaultValue={query.kategorija ?? ""}>
            <option value="">Sve kategorije</option>
            {roots.map((root) => (
              <optgroup key={root.id} label={root.name}>
                <option value={root.id}>{root.name}</option>
                {children(root.id).map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">Prikaži</button>
      </form>

      <form className="admin-panel" action={createProduct}>
        <h2>Novi artikal</h2>
        <div className="admin-form-grid">
          <label className="field"><span>Naziv</span><input name="name" required placeholder="Naziv proizvoda" /></label>
          <label className="field">
            <span>Kategorija</span>
            <select name="category" defaultValue="">
              <option value="">Bez kategorije</option>
              {roots.map((root) => (
                <optgroup key={root.id} label={root.name}>
                  {children(root.id).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field"><span>Veličina</span><input name="size" required placeholder="npr. 39-42" /></label>
          <label className="field"><span>Cena (RSD)</span><input name="price" required inputMode="decimal" placeholder="890" /></label>
        </div>
        <button className="btn" type="submit">Dodaj artikal</button>
      </form>

      <ul className="admin-catalog">
        {data.products.map((product) => (
          <li key={product.id}>
            <a href={`/admin/proizvodi/${product.id}`}>
              {product.image ? <img src={product.image} alt="" /> : <span className="admin-photo-empty">Nema slike</span>}
              <span>
                <strong>{product.name}</strong>
                <small>{product.categories.length ? product.categories.join(" · ") : "Bez kategorije"}</small>
                <small>{priceLabel(product.minPrice, product.maxPrice)} · {product.variantCount % 10 === 1 && product.variantCount % 100 !== 11 ? `${product.variantCount} varijacija` : product.variantCount % 10 >= 2 && product.variantCount % 10 <= 4 && (product.variantCount % 100 < 12 || product.variantCount % 100 > 14) ? `${product.variantCount} varijacije` : `${product.variantCount} varijacija`}</small>
                {product.status !== "published" ? <em>Skica</em> : null}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {data.products.length === 0 ? <p>Nema artikala za ovu pretragu.</p> : null}
    </div>
  );
}
