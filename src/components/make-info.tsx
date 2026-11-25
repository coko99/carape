import { FaqPage, InfoPage, pageCopy } from "@/components/info-page";
import { takeLocale } from "@/i18n/locale";

const pages = {
  pitanja: "faq",
  dostava: "shipping",
  reklamacije: "returns",
  privatnost: "privacy",
  kolacici: "cookies",
  uslovi: "terms",
  vesti: "news",
} as const;

export function makeInfo(kind: keyof typeof pages) {
  return async function Page({ params }: { params: Promise<{ locale: string }> }) {
    const locale = await takeLocale(params);
    if (kind === "pitanja") return <FaqPage locale={locale} />;
    const key = pages[kind];
    const titles = {
      shipping: locale === "sr" ? "Dostava i plaćanje" : "Delivery and payment",
      returns: locale === "sr" ? "Reklamacije" : "Returns",
      privacy: locale === "sr" ? "Privatnost" : "Privacy",
      cookies: locale === "sr" ? "Kolačići" : "Cookies",
      terms: locale === "sr" ? "Uslovi" : "Terms",
      news: locale === "sr" ? "Vesti" : "News",
    } as const;
    return (
      <InfoPage
        locale={locale}
        title={titles[key as keyof typeof titles]}
        body={pageCopy(locale, key as "shipping")}
        review={key !== "news" && key !== "cookies"}
      />
    );
  };
}
