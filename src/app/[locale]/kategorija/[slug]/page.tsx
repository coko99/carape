import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CatalogView, parseQuery } from "@/app/[locale]/proizvodi/page";
import { categoryTypeLabel, groupChildCategories } from "@/lib/type-groups";
import { takeLocale } from "@/i18n/locale";
import { getCategory } from "@/server/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await takeLocale(params);
  const data = await getCategory(slug);
  if (!data.category) return {};
  const name = categoryTypeLabel(data.category, locale, "title");
  return { title: name, description: data.category.description || name };
}

async function Body({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const locale = await takeLocale(params);
  const data = await getCategory(slug);
  if (!data.category) notFound();
  const name = categoryTypeLabel(data.category, locale, "title");
  const children = groupChildCategories(data.categories.filter((category) => category.parentSlug === slug), locale);
  const path = locale === "en" ? `/en/category/${slug}` : `/kategorija/${slug}`;
  return (
    <>
      {children.length ? (
        <div className="wrap type-board">
          {children.map((section) => {
            const lone = section.items.length === 1 && section.items[0]?.label === section.label ? section.items[0] : null;
            if (lone) {
              return (
                <Link key={section.id} className="type-lone-link" href={{ pathname: "/kategorija/[slug]", params: { slug: lone.slug } }}>
                  {section.label}
                </Link>
              );
            }
            return (
              <section key={section.id}>
                <h2>{section.label}</h2>
                <div>
                  {section.items.map((category) => (
                    <Link key={category.id} className="type-link" href={{ pathname: "/kategorija/[slug]", params: { slug: category.slug } }}>
                      {category.label}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      <CatalogView
        locale={locale}
        title={name}
        intro={data.category.description || undefined}
        query={{ ...parseQuery(await searchParams), category: slug }}
        locked={{ category: slug }}
        path={path}
      />
    </>
  );
}

export default function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="wrap py-16">…</div>}>
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  );
}
