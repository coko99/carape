import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { CheckoutForm } from "@/components/checkout-form";
import { takeLocale } from "@/i18n/locale";

async function Body({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  const t = await getTranslations("checkout");
  const account = await getTranslations("account");
  return (
    <div className="wrap max-w-3xl py-10">
      <CheckoutForm
        locale={locale}
        labels={{
          title: t("title"),
          contact: t("contact"),
          address: t("address"),
          payment: t("payment"),
          cod: t("cod"),
          bank: t("bank"),
          bankNote: t("bankNote"),
          coupon: t("coupon"),
          note: t("note"),
          place: t("place"),
          name: account("name"),
          email: account("email"),
          errors: {
            invalid: t("errors.invalid"),
            empty: t("errors.empty"),
            stock: t("errors.stock"),
            coupon: t("errors.coupon"),
            minimum: t("errors.minimum"),
            variant: t("errors.variant"),
            failed: t("errors.failed"),
            rate: t("errors.rate"),
          },
        }}
      />
    </div>
  );
}

export default function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  return <Suspense fallback={<div className="wrap py-16">…</div>}><Body params={params} /></Suspense>;
}
