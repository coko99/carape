import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProductGrid } from "@/components/product-card";
import { SockRail } from "@/components/sock-rail";
import { company, copy, faqs } from "@/content/copy";
import { categoryLabel } from "@/lib/catalog";
import { takeLocale } from "@/i18n/locale";
import { getCatalog } from "@/server/catalog";

async function HomeContent({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  const t = await getTranslations("home");
  const catalog = await getCatalog();
  const roots = catalog.categories.filter(
    (category) => !category.parentSlug && category.slug !== "najtrazeniji-proizvodi",
  );
  const featured = catalog.products.filter((product) => product.featured).slice(0, 3);
  const story = copy[locale].about.split("\n\n")[0];
  const homeArt: Record<string, string> = {
    "deciji-program": "/media/home/collection-children.jpg",
    "muski-program": "/media/home/collection-men.jpg",
    "medicinski-program": "/media/home/collection-medical.jpg",
    "sportski-program": "/media/home/collection-sport.jpg",
    "program-za-bebe": "/media/home/collection-baby.jpg",
    "zenski-pamucni-program": "/media/home/collection-women.jpg",
  };
  const ribbon = roots.map((category) => categoryLabel(category, locale));
  const loop = ribbon.length ? [...ribbon, ...ribbon] : [];
  const rail = catalog.products
    .filter((product) => product.images[0] && product.variants.some((variant) => variant.inStock))
    .slice(0, 8)
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      priceMinor: product.priceMinor,
      image: product.images[0]?.src ?? null,
      alt: product.images[0]?.alt ?? product.name,
      variants: product.variants.map((variant) => ({ id: variant.id, size: variant.size, inStock: variant.inStock })),
    }));

  return (
    <>
      <section className="wrap pt-6">
        <div className="hero-stage">
          <img src="/media/home/home-hero.jpg?v=2" alt="" />
          <div className="hero-glass">
            <p className="kicker">{company.city} · {company.founded}</p>
            <h1 className="mt-4 max-w-xl text-4xl leading-[0.95] md:text-6xl">{t("title")}</h1>
            <p className="mt-5 max-w-md text-[1.02rem] leading-7 text-muted">{t("text")}</p>
            <div className="mt-7 flex flex-wrap items-center gap-6">
              <Link className="btn" href="/proizvodi">{t("cta")}</Link>
              <Link className="link-quiet" href="/o-nama">{t("story")}</Link>
            </div>
          </div>
          <ul className="hero-stats">
            <li>
              <strong>{company.founded}</strong>
              <span>{company.city}</span>
            </li>
            <li>
              <strong>{catalog.products.length}</strong>
              <span>{locale === "sr" ? "artikala" : "styles"}</span>
            </li>
            <li>
              <strong>{locale === "sr" ? "Pamuk" : "Cotton"}</strong>
              <span>{locale === "sr" ? "češljani program" : "combed cotton"}</span>
            </li>
          </ul>
        </div>
      </section>

      {loop.length ? (
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {loop.map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}
          </div>
        </div>
      ) : null}

      <SockRail products={rail} locale={locale} commerce={catalog.commerce} />

      <section id="kolekcije" className="wrap py-16">
        <p className="kicker">{locale === "sr" ? "Programi" : "Programmes"}</p>
        <h2 className="mt-3 text-4xl md:text-5xl">{locale === "sr" ? "Kolekcije" : "Collections"}</h2>
        <div className="collection-grid mt-8">
          {roots.map((category) => (
            <Link
              key={category.id}
              href={{ pathname: "/kategorija/[slug]", params: { slug: category.slug } }}
              className="category-tile group"
            >
              <img src={homeArt[category.slug] || category.image || "/media/home/home-hero.jpg?v=2"} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent" />
              <div className="absolute bottom-4 left-4 z-10">
                <h3 className="glass-label text-lg">{categoryLabel(category, locale)}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="kicker">{locale === "sr" ? "Katalog" : "Catalog"}</p>
            <h2 className="mt-3 text-4xl md:text-5xl">{locale === "sr" ? "Izdvojeni proizvodi" : "Selected products"}</h2>
          </div>
          <Link href="/najtrazenije" className="link-quiet text-sm">{t("cta")}</Link>
        </div>
        <ProductGrid products={featured} locale={locale} commerce={catalog.commerce} />
        <p className="mt-4 max-w-2xl text-sm text-muted">{t("featuredNote")}</p>
      </section>

      <section className="wrap py-10">
        <div className="band grid items-center gap-8 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-12">
          <div>
            <p className="kicker text-white/80">{locale === "sr" ? "Paketi" : "Bundles"}</p>
            <h2 className="mt-4 text-4xl text-white md:text-6xl">{locale === "sr" ? "Napravi svoj paket." : "Build your bundle."}</h2>
            <p className="mt-4 max-w-md leading-7 text-[#f4efe6]/80">
              {locale === "sr"
                ? "Parovi se biraju iz kataloga kada je kampanja uključena. Cena paketa računa se na serveru."
                : "Pairs are chosen from the catalog when a campaign is on. The package price is calculated on the server."}
            </p>
            <Link className="link-quiet mt-6 inline-block text-[#f4efe6]" href="/paketi">{locale === "sr" ? "Kreiraj paket" : "Create a bundle"}</Link>
          </div>
          <img src="/media/home/home-bundle.jpg?v=2" alt="" className="aspect-[5/4] w-full object-cover" />
        </div>
      </section>

      <section className="wrap grid items-center gap-12 py-20 md:grid-cols-2">
        <figure className="hero-frame min-h-[460px]">
          <img src="/media/home/home-workshop.jpg?v=2" alt="" />
        </figure>
        <div>
          <p className="kicker">{locale === "sr" ? "Radionica" : "Workshop"}</p>
          <h2 className="mt-3 text-4xl md:text-5xl">{locale === "sr" ? "Naša proizvodnja." : "Our workshop."}</h2>
          <p className="mt-2 font-display text-3xl">{company.founded}</p>
          <p className="mt-5 leading-7 text-muted">{story}</p>
          <ul className="mt-8 grid gap-3">
            {t.raw("quality").map((item: string) => (
              <li key={item} className="border border-line px-4 py-3 text-sm">{item}</li>
            ))}
          </ul>
          <Link className="btn mt-8" href="/o-nama">{t("story")}</Link>
        </div>
      </section>

      <section className="wrap py-16">
        <p className="kicker">{locale === "sr" ? "Podrška" : "Support"}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl md:text-5xl">{locale === "sr" ? "Najčešća pitanja" : "Common questions"}</h2>
          <Link href="/pitanja" className="link-quiet text-sm">{locale === "sr" ? "Sva pitanja" : "All questions"}</Link>
        </div>
        <div className="faq-list mt-8">
          {faqs[locale].slice(0, 4).map(([question, answer]) => (
            <details key={question} className="faq-item">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={<div className="wrap py-20">…</div>}>
      <HomeContent params={params} />
    </Suspense>
  );
}
