import { takeLocale } from "@/i18n/locale";
import { InfoPage, pageCopy } from "@/components/info-page";
import { InquiryForm } from "@/components/inquiry-form";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  return (
    <div className="wrap max-w-3xl py-12">
      <InfoPage locale={locale} title={locale === "sr" ? "Po meri i veleprodaja" : "Custom and wholesale"} body={pageCopy(locale, "custom")} />
      <InquiryForm locale={locale} type="wholesale" />
    </div>
  );
}
