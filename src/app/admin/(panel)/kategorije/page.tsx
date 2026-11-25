import { createCategory, listCategoriesAdmin, saveCategory } from "@/server/catalog-admin";

export const instant = false;

export default async function Page({ searchParams }: { searchParams: Promise<{ greska?: string; poruka?: string }> }) {
  const notice = await searchParams;
  const categories = await listCategoriesAdmin();
  const roots = categories.filter((category) => !category.parentId);
  const children = (parentId: string) => categories.filter((category) => category.parentId === parentId);

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <h1>Kategorije</h1>
          <p>Naziv, redosled i slika. Skica se ne prikazuje u prodavnici.</p>
        </div>
      </header>
      {notice.greska ? <p className="admin-note bad">{notice.greska}</p> : null}
      {notice.poruka ? <p className="admin-note">{notice.poruka}</p> : null}

      <form className="admin-panel" action={createCategory}>
        <h2>Nova kategorija</h2>
        <div className="admin-form-grid">
          <label className="field"><span>Naziv</span><input name="name" required /></label>
          <label className="field">
            <span>Unutar</span>
            <select name="parent" defaultValue="">
              <option value="">Glavna kategorija</option>
              {roots.map((category) => <option key={category.id} value={category.id}>{category.nameSr}</option>)}
            </select>
          </label>
          <label className="field"><span>Redosled</span><input name="sort" type="number" defaultValue={0} /></label>
          <label className="field"><span>Slika</span><input name="file" type="file" accept="image/*" /></label>
        </div>
        <label className="field"><span>Opis</span><textarea name="description" rows={2} /></label>
        <button className="btn" type="submit">Dodaj kategoriju</button>
      </form>

      <div className="admin-categories">
        {roots.map((root) => (
          <section key={root.id} className="admin-panel">
            <CategoryForm category={root} />
            <div className="admin-subcategories">
              {children(root.id).map((category) => <CategoryForm key={category.id} category={category} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CategoryForm({ category }: { category: Awaited<ReturnType<typeof listCategoriesAdmin>>[number] }) {
  return (
    <form className="admin-category" action={saveCategory}>
      <input type="hidden" name="id" value={category.id} />
      {category.image ? <img src={category.image} alt="" /> : <span className="admin-photo-empty">Nema slike</span>}
      <div className="admin-category-fields">
        <label className="field"><span>Naziv</span><input name="name" required defaultValue={category.nameSr} /></label>
        <label className="field"><span>Redosled</span><input name="sort" type="number" defaultValue={category.sortOrder} /></label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={category.status === "draft" ? "draft" : "published"}>
            <option value="published">Objavljena</option>
            <option value="draft">Skica</option>
          </select>
        </label>
        <label className="field admin-span"><span>Opis</span><textarea name="description" rows={2} defaultValue={category.descriptionSr} /></label>
        <label className="field"><span>Nova slika</span><input name="file" type="file" accept="image/*" /></label>
        <div className="admin-row-actions">
          <small>{category.productCount} artikala</small>
          <button className="btn" type="submit">Sačuvaj</button>
        </div>
      </div>
    </form>
  );
}
