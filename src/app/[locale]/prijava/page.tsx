import { takeLocale } from "@/i18n/locale";
import { AuthForm } from "@/components/auth-form";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  return <div className="wrap py-12"><AuthForm mode="login" locale={locale} /></div>;
}
