import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { connection } from "next/server";
import { routing } from "@/i18n/routing";

export async function takeLocale(params: Promise<{ locale: string }>) {
  await connection();
  const { locale } = await params;
  const safe = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(safe);
  return safe === "en" ? ("en" as const) : ("sr" as const);
}
