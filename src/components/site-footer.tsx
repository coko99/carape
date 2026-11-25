import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { company } from "@/content/copy";
import { NewsletterForm } from "@/components/newsletter-form";

export async function SiteFooter({ locale }: { locale: "sr" | "en" }) {
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <footer className="site-footer">
      <div className="wrap grid gap-10 py-16 md:grid-cols-4">
        <div>
          <p className="wordmark">ŽA—JO</p>
          <p className="mt-4 text-sm leading-6 text-muted">
            {company.address}, {company.postalCode} {company.city}
            <br />
            <a href={`mailto:${company.email}`}>{company.email}</a>
          </p>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{t("nav.shop")}</p>
          <Link href="/proizvodi">{locale === "sr" ? "Sve čarape" : "All socks"}</Link>
          <Link href="/najtrazenije">{t("home.featured")}</Link>
          <Link href="/paketi">{t("nav.bundles")}</Link>
          <Link href="/veleprodaja">{t("nav.wholesale")}</Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{locale === "sr" ? "Naša priča" : "Our story"}</p>
          <Link href="/o-nama">{t("nav.about")}</Link>
          <Link href="/po-meri">{t("nav.custom")}</Link>
          <Link href="/dizajniraj">{t("nav.design")}</Link>
          <Link href="/kontakt">{t("nav.contact")}</Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{locale === "sr" ? "Podrška" : "Support"}</p>
          <Link href="/dostava">{locale === "sr" ? "Dostava" : "Delivery"}</Link>
          <Link href="/reklamacije">{locale === "sr" ? "Reklamacije" : "Returns"}</Link>
          <Link href="/pitanja">{locale === "sr" ? "Najčešća pitanja" : "FAQ"}</Link>
          <Link href="/privatnost">{locale === "sr" ? "Privatnost" : "Privacy"}</Link>
        </div>
      </div>
      <div className="wrap pb-10">
        <NewsletterForm locale={locale} title={t("home.newsletter")} text={t("home.newsletterText")} consent={t("forms.consent")} send={t("forms.send")} sent={t("forms.sent")} />
      </div>
      <div className="wrap flex flex-wrap justify-between gap-3 border-t border-line py-4 text-xs text-muted">
        <p>© 2026 {company.shortName}</p>
        <p>{company.people.map((person) => `${person.name} ${person.phone}`).join(" · ")}</p>
      </div>
    </footer>
  );
}
