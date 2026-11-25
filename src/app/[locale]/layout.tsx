import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CookieBanner } from "@/components/cookie-banner";
import { ChatDock } from "@/components/chat-dock";
import { ShopAssistant } from "@/components/shop-assistant";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";

export const instant = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await connection();
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const safeLocale = locale === "en" ? "en" : "sr";
  return (
    <NextIntlClientProvider locale={safeLocale} messages={messages}>
      <a className="skip" href="#sadrzaj">
        {safeLocale === "sr" ? "Preskoči na sadržaj" : "Skip to content"}
      </a>
      <Suspense fallback={<div className="h-20" />}>
        <SiteHeader locale={safeLocale} />
      </Suspense>
      <main id="sadrzaj">{children}</main>
      <ShopAssistant />
      <ChatDock locale={safeLocale} />
      <Suspense fallback={null}>
        <SiteFooter locale={safeLocale} />
      </Suspense>
      <CookieBanner locale={safeLocale} />
    </NextIntlClientProvider>
  );
}
