import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalTypeKey, catalogHref, foldSearch, matchesProduct, paginate, sortProducts, typeKey, type SearchProduct } from "./search.ts";

function product(partial: Partial<SearchProduct> & Pick<SearchProduct, "id" | "variants">): SearchProduct {
  return {
    name: partial.id,
    description: "",
    shortDescription: "",
    categoryNames: [],
    categorySlugs: [],
    typeKeys: [],
    priceMinor: Math.min(...partial.variants.map((variant) => variant.priceMinor)),
    onSale: false,
    featured: false,
    isNew: false,
    audiences: [],
    createdAt: "2026-01-01",
    ...partial,
  };
}

const blackLarge = product({
  id: "sport",
  name: "Sportska čarapa",
  categoryNames: ["Sportske čarape"],
  categorySlugs: ["sportska-carapa"],
  typeKeys: ["sportske-carape"],
  variants: [
    { id: "a", size: "39-42", color: "crna", sku: "A-1", priceMinor: 40000, inStock: true },
    { id: "b", size: "43-46", color: "bela", sku: "A-2", priceMinor: 40000, inStock: true },
  ],
});

const split = product({
  id: "split",
  name: "Klasična",
  typeKeys: ["klasicne-carape"],
  variants: [
    { id: "c", size: "43-46", color: "bela", sku: null, priceMinor: 50000, inStock: true },
    { id: "d", size: "39-42", color: "crna", sku: null, priceMinor: 50000, inStock: false },
  ],
});

describe("catalog search", () => {
  it("folds Serbian Latin, Cyrillic and missing diacritics to the same text", () => {
    assert.equal(foldSearch("Čarapa"), foldSearch("carapa"));
    assert.equal(foldSearch("чарапа"), foldSearch("carapa"));
    assert.equal(foldSearch("teget"), foldSearch("Тегет"));
  });

  it("requires color and size on the same variant", () => {
    assert.equal(matchesProduct(blackLarge, { colors: ["crna"], sizes: ["43-46"] }), false);
    assert.equal(matchesProduct(blackLarge, { colors: ["crna"], sizes: ["39-42"] }), true);
    assert.equal(matchesProduct(split, { colors: ["crna"], sizes: ["43-46"] }), false);
  });

  it("combines type, price, stock and search", () => {
    assert.equal(
      matchesProduct(blackLarge, { types: ["sportske-carape"], colors: ["crna"], min: 30000, max: 80000, q: "спорт" }),
      true,
    );
    assert.equal(matchesProduct(blackLarge, { min: 90000 }), false);
    assert.equal(matchesProduct(split, { colors: ["crna"], availableSizes: true }), false);
    assert.equal(matchesProduct(blackLarge, { q: "nepostojeca sifra" }), false);
    assert.equal(matchesProduct(blackLarge, { q: "A-1" }), true);
  });

  it("treats singular and plural sock names as one type", () => {
    const ankle = product({ id: "ankle", typeKeys: ["sokne"], variants: [{ id: "s", size: "35-38", color: null, sku: null, priceMinor: 10000, inStock: true }] });
    assert.equal(matchesProduct(ankle, { types: ["sokna"] }), true);
    assert.equal(matchesProduct(ankle, { types: ["nazuvice"] }), false);
    assert.equal(canonicalTypeKey("nazuvica"), "nazuvice");
    const names = [
      "Biciklistička čarapa", "Dokolenica", "Fitnes čarapa", "Folklorna dokolenica", "Klasična čarapa",
      "Klasična čarapa bez gumice", "Klasična sportska", "Lovačka termo čarapa", "Lovačka termo dokolenica",
      "Nadkolenica", "Nazuvica", "Nazuvice", "Odbojkaška dokolenica", "Skijaška termo", "Sokna", "Sokne",
      "Sport kids", "Sport polu-termo stopalo", "Štucna", "Termo bez gumice",
    ];
    const known = new Set([
      "nazuvice", "sokne", "klasicna-carapa", "klasicna-sportska", "biciklisticka-carapa", "fitnes-carapa",
      "sport-polu-termo-stopalo", "skijaska-termo", "lovacka-termo-carapa", "dokolenica", "folklorna-dokolenica",
      "odbojkaska-dokolenica", "lovacka-termo-dokolenica", "nadkolenica", "stucna", "sport-kids",
      "klasicna-carapa-bez-gumice", "termo-bez-gumice",
    ]);
    for (const name of names) assert.equal(known.has(canonicalTypeKey(typeKey(name))), true, name);
  });

  it("sorts by real sales and paginates without dropping filters in the url", () => {
    const ranked = sortProducts([blackLarge, split], "popular", new Map([["split", 4]]));
    assert.equal(ranked[0]?.id, "split");
    const named = sortProducts([product({ ...blackLarge, name: "Šarena" }), product({ ...split, name: "Bela" })], "name-desc");
    assert.equal(named[0]?.name, "Šarena");
    const page = paginate([1, 2, 3], 2, 2);
    assert.deepEqual(page.items, [3]);
    const href = catalogHref("/proizvodi", { colors: ["crna", "bela"], sizes: ["43-46"], min: 30000, max: 80000, sort: "price-asc", page: 2 });
    assert.match(href, /boja=crna/);
    assert.match(href, /boja=bela/);
    assert.match(href, /velicina=43-46/);
    assert.match(href, /min=300/);
    assert.match(href, /page=2/);
    const cleared = catalogHref("/proizvodi", { colors: ["crna"] }, { colors: [] });
    assert.equal(cleared, "/proizvodi");
  });
});