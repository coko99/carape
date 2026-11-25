import { Suspense } from "react";
import { CatalogView, parseQuery } from "@/app/[locale]/proizvodi/page";
import { takeLocale } from "@/i18n/locale";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Suspense><Body params={params} searchParams={searchParams} /></Suspense>;
}

async function Body({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await takeLocale(params);
  return <CatalogView locale={locale} title={locale === "sr" ? "Sniženje" : "Sale"} query={{ ...parseQuery(await searchParams), sale: true }} locked={{ sale: true }} path={locale === "en" ? "/en/sale" : "/snizenje"} />;
}
