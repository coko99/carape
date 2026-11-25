"use client";

import { useState } from "react";
import { formatRsd } from "@/lib/commerce";

type ColorOption = { slug: string; name: string; hex: string | null };
type SizeOption = { label: string; available: boolean };
type TypeFamily = { label: string; items: { key: string; label: string }[] };

export function CatalogFilters({
  colors,
  sizes,
  typeFamilies,
  audiences,
  selected,
  bounds,
  total,
  resetHref,
  locale,
}: {
  colors: ColorOption[];
  sizes: SizeOption[];
  typeFamilies: TypeFamily[];
  audiences: { slug: string; label: string }[];
  selected: {
    q?: string;
    colors: string[];
    sizes: string[];
    types: string[];
    audience?: string;
    min?: number;
    max?: number;
    availableSizes?: boolean;
    sort?: string;
  };
  bounds: { min: number; max: number };
  total: number;
  resetHref: string;
  locale: "sr" | "en";
}) {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(selected.min != null ? String(selected.min / 100) : "");
  const [max, setMax] = useState(selected.max != null ? String(selected.max / 100) : "");
  const [count, setCount] = useState(total);
  const [baseline, setBaseline] = useState(total);
  if (baseline !== total) {
    setBaseline(total);
    setCount(total);
  }
  const [suggestions, setSuggestions] = useState<{ name: string; slug: string; priceMinor: number; image: string | null }[]>([]);
  const active = selected.colors.length + selected.sizes.length + selected.types.length + (selected.min != null || selected.max != null ? 1 : 0) + (selected.availableSizes ? 1 : 0) + (selected.q ? 1 : 0);
  const low = Math.floor(bounds.min / 100);
  const high = Math.ceil(bounds.max / 100);

  async function preview(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value !== "") params.append(key, value);
    }
    params.delete("page");
    const response = await fetch(`/api/pretraga?${params.toString()}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { total: number; suggestions: typeof suggestions };
    setCount(payload.total);
    const query = String(params.get("q") ?? "");
    setSuggestions(query.trim().length >= 2 ? payload.suggestions ?? [] : []);
  }

  return (
    <div>
      <button type="button" className="btn filter-toggle sticky top-20 z-20 mb-4 md:hidden" aria-expanded={open} aria-controls="filteri" onClick={() => setOpen(true)}>
        Filteri{active ? ` (${active})` : ""}
      </button>
      <form id="filteri" method="get" className={`${open ? "fixed inset-0 z-50 overflow-auto bg-paper p-4" : "hidden"} md:static md:block md:glass-panel md:p-4`} onChange={(event) => preview(event.currentTarget)}>
        <div className="mb-4 flex items-center justify-between md:hidden">
          <h2 className="text-2xl">Filteri</h2>
          <button type="button" className="underline" onClick={() => setOpen(false)}>Zatvori</button>
        </div>
        <div className="grid gap-6">
          <label className="field relative">
            <span>Pretraga</span>
            <input name="q" defaultValue={selected.q ?? ""} placeholder="Naziv, šifra, boja, veličina" autoComplete="off" />
            {suggestions.length ? (
              <ul className="absolute z-10 mt-1 w-full border border-line bg-paper">
                {suggestions.map((item) => (
                  <li key={item.slug}>
                    <a className="flex items-center gap-2 px-2 py-2 no-underline" href={locale === "en" ? `/en/product/${item.slug}` : `/proizvod/${item.slug}`}>
                      {item.image ? <img src={item.image} alt="" className="h-10 w-10 object-cover" /> : null}
                      <span>{item.name}<br /><span className="text-muted">{formatRsd(item.priceMinor)}</span></span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          <details open className="border-t border-line pt-4">
            <summary className="cursor-pointer">Boja</summary>
            {colors.length === 0 ? <p className="mt-2 text-sm text-muted">Nijedna varijanta još nema dodeljenu boju.</p> : (
              <div className="mt-3 flex flex-wrap gap-2">
                {colors.map((color) => (
                  <label key={color.slug} className="grid justify-items-center gap-1 text-xs has-[:checked]:outline has-[:checked]:outline-offset-2">
                    <input className="sr-only" type="checkbox" name="boja" value={color.slug} defaultChecked={selected.colors.includes(color.slug)} />
                    <span className="block h-8 w-8 rounded-full border border-line" style={{ background: color.hex ?? "transparent" }} />
                    {color.name}
                  </label>
                ))}
              </div>
            )}
          </details>
          <details open className="border-t border-line pt-4">
            <summary className="cursor-pointer">Tip čarapa</summary>
            <div className="type-families">
              {typeFamilies.map((family) => {
                const lone = family.items.length === 1 && family.items[0]?.label === family.label ? family.items[0] : null;
                if (lone) {
                  return (
                    <label key={lone.key} className="type-lone">
                      <input type="checkbox" name="tip" value={lone.key} defaultChecked={selected.types.includes(lone.key)} />
                      {family.label}
                    </label>
                  );
                }
                return (
                  <fieldset key={family.label} className="type-family">
                    <legend>{family.label}</legend>
                    {family.items.map((item) => (
                      <label key={item.key}>
                        <input type="checkbox" name="tip" value={item.key} defaultChecked={selected.types.includes(item.key)} />
                        {item.label}
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
          </details>
          <details open className="border-t border-line pt-4">
            <summary className="cursor-pointer">Veličina</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((size) => (
                <label key={size.label} className={size.available ? "" : "opacity-40"}>
                  <input className="peer sr-only" type="checkbox" name="velicina" value={size.label} defaultChecked={selected.sizes.includes(size.label)} />
                  <span className="inline-block border border-line px-3 py-2 peer-checked:border-ink peer-checked:bg-paper-2">{size.label}</span>
                </label>
              ))}
            </div>
            <label className="mt-3 flex gap-2 text-sm">
              <input type="checkbox" name="dostupno" value="1" defaultChecked={selected.availableSizes} />
              Prikaži samo dostupne veličine
            </label>
          </details>
          <details open className="border-t border-line pt-4">
            <summary className="cursor-pointer">Cena</summary>
            <p className="mt-2 text-sm text-muted">Cena: {formatRsd(bounds.min)} – {formatRsd(bounds.max)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="field"><span>Od</span><input name="min" inputMode="numeric" value={min} onChange={(event) => setMin(event.target.value)} /></label>
              <label className="field"><span>Do</span><input name="max" inputMode="numeric" value={max} onChange={(event) => setMax(event.target.value)} /></label>
            </div>
            <input className="mt-3 w-full" type="range" min={low} max={high || low} value={min || String(low)} aria-label="Najniža cena" onChange={(event) => setMin(event.target.value)} />
            <input className="mt-2 w-full" type="range" min={low} max={high || low} value={max || String(high)} aria-label="Najviša cena" onChange={(event) => setMax(event.target.value)} />
          </details>
          {audiences.length ? (
            <label className="field">
              <span>Program</span>
              <select name="audience" defaultValue={selected.audience ?? ""}>
                <option value="">Sve</option>
                {audiences.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>Redosled</span>
            <select name="sort" defaultValue={selected.sort ?? "featured"}>
              <option value="featured">Preporučeno</option>
              <option value="newest">Najnovije</option>
              <option value="price-asc">Cena: od najniže</option>
              <option value="price-desc">Cena: od najviše</option>
              <option value="popular">Najprodavanije</option>
              <option value="name">Naziv: A–Š</option>
              <option value="name-desc">Naziv: Š–A</option>
            </select>
          </label>
          <button className="btn" type="submit">Prikaži rezultate ({count})</button>
          <a className="text-sm underline" href={resetHref}>Obriši filtere</a>
        </div>
      </form>
    </div>
  );
}