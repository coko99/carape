import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ProductGrid } from "@/components/product-card";
import { CatalogFilters } from "@/components/catalog-filters";
import { categoryLabel, type CatalogQuery } from "@/lib/catalog";
import { canonicalTypeKey, catalogHref } from "@/lib/search";
import { groupTypeOptions, typeChipLabel } from "@/lib/type-groups";
import { searchCatalog } from "@/server/shop-search";
import { Link } from "@/i18n/navigation";
import { takeLocale } from "@/i18n/locale";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
}

function money(value: string | undefined) {
  if (!value) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  return Math.round(amount * 100);
}

export function parseQuery(raw: Record<string, string | string[] | undefined>): CatalogQuery {
  const audienceMap: Record<string, string> = {
    "muski-program": "men",
    "zenski-pamucni-program": "women",
    "deciji-program": "children",
    "program-za-bebe": "baby",
    "sportski-program": "sport",
    "medicinski-program": "medical",
  };
  const audienceRaw = one(raw.audience);
  const page = Number(one(raw.page) || "1");
  const sort = one(raw.sort);
  return {
    q: one(raw.q),
    audience: audienceRaw ? audienceMap[audienceRaw] ?? audienceRaw : undefined,
    size: one(raw.size),
    sizes: many(raw.velicina ?? raw.size),
    colors: many(raw.boja),
    types: many(raw.tip),
    sort: (sort as CatalogQuery["sort"]) || "featured",
    available: one(raw.available) === "1",
    availableSizes: one(raw.dostupno) === "1",
    sale: one(raw.sale) === "1",
    min: money(one(raw.min)),
    max: money(one(raw.max)),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function CatalogView({
  title,
  intro,
  query,
  locked,
  locale,
  path,
}: {
  title: string;
  intro?: string;
  query: CatalogQuery;
  locked?: Partial<CatalogQuery>;
  locale: "sr" | "en";
  path: string;
}) {
  const t = await getTranslations("shop");
  const merged = { ...query, ...locked, page: query.page };
  const result = await searchCatalog(merged);
  const chips = [
    ...(merged.colors ?? []).map((value) => ({ label: result.colorOptions.find((color) => color.slug === value)?.name ?? value, href: catalogHref(path, merged, { colors: (merged.colors ?? []).filter((item) => item !== value), page: 1 }) })),
    ...(merged.sizes ?? []).map((value) => ({ label: value, href: catalogHref(path, merged, { sizes: (merged.sizes ?? []).filter((item) => item !== value), page: 1 }) })),
    ...(merged.types ?? []).map((value) => {
      const type = result.typeOptions.find((item) => item.key === canonicalTypeKey(value));
      return { label: type ? typeChipLabel(type, locale) : value, href: catalogHref(path, merged, { types: (merged.types ?? []).filter((item) => canonicalTypeKey(item) !== canonicalTypeKey(value)), page: 1 }) };
    }),
    ...(merged.min != null || merged.max != null ? [{ label: "Cena", href: catalogHref(path, merged, { min: undefined, max: undefined, page: 1 }) }] : []),
  ];
  return (
    <div className="wrap py-10">
      <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
        <CatalogFilters
          colors={result.colorOptions}
          sizes={result.sizeOptions}
          typeFamilies={groupTypeOptions(result.typeOptions, locale)}
          audiences={result.catalog.categories.filter((category) => !category.parentSlug && category.slug !== "najtrazeniji-proizvodi").map((category) => ({
            slug: ({
              "muski-program": "men",
              "zenski-pamucni-program": "women",
              "deciji-program": "children",
              "program-za-bebe": "baby",
              "sportski-program": "sport",
              "medicinski-program": "medical",
            } as Record<string, string>)[category.slug] ?? category.slug,
            label: categoryLabel(category, locale),
          }))}
          selected={{
            q: merged.q,
            colors: merged.colors ?? [],
            sizes: merged.sizes ?? [],
            types: (merged.types ?? []).map((value) => canonicalTypeKey(value)),
            audience: merged.audience,
            min: merged.min,
            max: merged.max,
            availableSizes: merged.availableSizes,
            sort: merged.sort,
          }}
          bounds={result.bounds}
          total={result.total}
          resetHref={path}
          locale={locale}
        />
        <div>
          <p className="kicker">{locale === "sr" ? "Katalog" : "Catalog"}</p>
          <h1 className="mt-3 text-5xl md:text-6xl">{title}</h1>
          {intro ? <p className="mt-4 max-w-2xl leading-7">{intro}</p> : null}
          <p className="mt-3 text-sm text-muted">{result.total} {t("results")}</p>
          {chips.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.href + chip.label}>
                  <a className="border border-line px-3 py-1 text-sm no-underline" href={chip.href}>{chip.label} ×</a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-8">
            {result.products.length ? (
              <ProductGrid products={result.products} locale={locale} colors={result.colorOptions} commerce={result.catalog.commerce} />
            ) : (
              <div className="border border-line bg-paper-2 p-8">
                <p>{t("empty")}</p>
                <a className="btn mt-4" href={path}>Obriši filtere</a>
              </div>
            )}
          </div>
          {result.pages > 1 ? (
            <nav className="mt-8 flex flex-wrap gap-2" aria-label="Stranice">
              {Array.from({ length: result.pages }, (_, index) => index + 1).map((page) => (
                <a key={page} className={`page-pill ${page === result.page ? "is-current" : ""}`} href={catalogHref(path, merged, { page })}>{page}</a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
      <p className="mt-8 text-sm">
        <Link href="/snizenje">{t("sale")}</Link>
      </p>
    </div>
  );
}

export default function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="wrap py-16">…</div>}>
      <ShopBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ShopBody({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await takeLocale(params);
  const t = await getTranslations("shop");
  const raw = await searchParams;
  return <CatalogView locale={locale} title={t("title")} query={parseQuery(raw)} path={locale === "en" ? "/en/products" : "/proizvodi"} />;
}
