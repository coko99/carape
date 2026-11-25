import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { CatalogView, parseQuery } from "@/app/[locale]/proizvodi/page";
import { takeLocale } from "@/i18n/locale";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <Suspense fallback={<div className="wrap py-16">…</div>}><Body params={params} searchParams={searchParams} /></Suspense>;
}

async function Body({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await takeLocale(params);
  const t = await getTranslations("home");
  return <CatalogView locale={locale} title={t("featured")} query={{ ...parseQuery(await searchParams), featured: true }} locked={{ featured: true }} path={locale === "en" ? "/en/bestsellers" : "/najtrazenije"} />;
}
