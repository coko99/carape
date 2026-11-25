import { takeLocale } from "@/i18n/locale";
import { InfoPage, pageCopy } from "@/components/info-page";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  return <InfoPage locale={locale} title={locale === "sr" ? "O proizvođaču" : "The maker"} body={pageCopy(locale, "about")} />;
}
