import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getCartLines } from "@/server/cart";
import { MobileNav } from "@/components/mobile-nav";

async function CartCount() {
  let count = 0;
  try {
    const lines = await getCartLines();
    count = lines.reduce((sum, line) => sum + line.quantity, 0);
  } catch {
    count = 0;
  }
  return <span className="tabular-nums">{count}</span>;
}

export async function SiteHeader({ locale }: { locale: "sr" | "en" }) {
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const other = locale === "sr" ? "en" : "sr";
  return (
    <header className="site-header">
      <div className="wrap grid grid-cols-[1fr_auto] items-center gap-4 py-4 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="wordmark" aria-label="ŽA-JO KOMERC">ŽA—JO</Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          <Link className="nav-link" href="/">{locale === "sr" ? "Početna" : "Home"}</Link>
          <Link className="nav-link" href="/proizvodi">{t("shop")}</Link>
          <Link className="nav-link" href={{ pathname: "/", hash: "#kolekcije" }}>{locale === "sr" ? "Kolekcije" : "Collections"}</Link>
          <Link className="nav-link" href="/pitanja">{locale === "sr" ? "Pitanja" : "FAQ"}</Link>
          <Link className="nav-link" href="/o-nama">{locale === "sr" ? "Naša priča" : "Our story"}</Link>
        </nav>
        <div className="flex items-center justify-end gap-5 text-sm">
          <Link href="/pretraga" className="nav-link hidden sm:inline">{t("search")}</Link>
          <Link href="/korpa" className="nav-link">
            {t("cart")} (<Suspense fallback={<span>0</span>}><CartCount /></Suspense>)
          </Link>
          <Link href="/" locale={other} className="nav-link hidden lg:inline">{t("language")}</Link>
          <MobileNav labels={{ shop: t("shop"), about: t("about"), custom: t("custom"), contact: t("contact"), menu: t("menu") }} />
        </div>
      </div>
    </header>
  );
}
