import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BuyBox } from "@/components/buy-box";
import { ProductGrid } from "@/components/product-card";
import { RecentView } from "@/components/recent-view";
import { WishButton } from "@/components/wish-button";
import { formatRsd } from "@/lib/commerce";
import { filterCatalog } from "@/lib/catalog";
import { takeLocale } from "@/i18n/locale";
import { getProduct } from "@/server/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  await takeLocale(params);
  const data = await getProduct(slug);
  if (!data.product) return {};
  const product = data.product;
  return {
    title: product.name,
    description: product.shortDescription || product.name,
    alternates: { canonical: `/proizvod/${product.slug}` },
    openGraph: { images: product.images[0] ? [product.images[0].src] : [] },
  };
}

async function Body({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const locale = await takeLocale(params);
  const t = await getTranslations("product");
  const checkout = await getTranslations("checkout");
  const data = await getProduct(slug);
  if (!data.product) notFound();
  const product = data.product;
  const catalog = await (await import("@/server/catalog")).getCatalog();
  const more = filterCatalog(catalog.products, { category: product.categorySlugs[0] })
    .filter((item) => item.id !== product.id)
    .slice(0, 4);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || product.name,
    image: product.images.map((image) => image.src),
    sku: product.variants.find((variant) => variant.sku)?.sku,
    brand: { "@type": "Brand", name: "ŽA-JO KOMERC" },
    offers: {
      "@type": "Offer",
      priceCurrency: "RSD",
      price: (product.priceMinor / 100).toFixed(2),
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: product.sourceUrl,
    },
  };

  const [lead, ...rest] = product.images;

  return (
    <article className="wrap py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid items-start gap-8 md:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-3">
          {lead ? (
            <figure className="hero-frame min-h-[28rem] md:min-h-[36rem]">
              <img src={lead.src} alt={lead.alt} />
            </figure>
          ) : null}
          {rest.length ? (
            <div className="grid grid-cols-2 gap-3">
              {rest.map((image) => (
                <div key={image.src} className="card-media">
                  <img src={image.src} alt={image.alt} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="buy-panel md:sticky md:top-24">
          <p className="kicker">{product.categoryNames[0] ?? (locale === "sr" ? "Katalog" : "Catalog")}</p>
          <h1 className="mt-3 text-4xl md:text-5xl">{product.name}</h1>
          <p className="mt-4 text-2xl font-semibold tracking-tight">{formatRsd(product.priceMinor, locale)}</p>
          {product.shortDescription ? <p className="mt-4 leading-7 text-muted">{product.shortDescription}</p> : null}
          {locale === "en" ? (
            <p className="mt-3 text-sm text-muted">Description is shown in the original Serbian. An English product translation has not been supplied.</p>
          ) : null}
          <div className="mt-6">
            <BuyBox
              product={product}
              locale={locale}
              labels={{
                size: t("size"),
                add: t("add"),
                added: t("added"),
                priceNote: t("priceNote"),
                quantity: locale === "sr" ? "Količina" : "Quantity",
                stockUnknown: product.variants.some((variant) => variant.stockQuantity != null) ? t("stockKnown") : t("stockUnknown"),
                stockOut: t("stockOut"),
                disabled: checkout("disabled"),
                commerce: data.commerce,
              }}
            />
            <WishButton slug={product.slug} label={locale === "sr" ? "Sačuvaj" : "Save"} />
          </div>
          <dl className="mt-8 grid gap-3 border-t border-line pt-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("sku")}</dt>
              <dd>{product.variants.find((variant) => variant.sku)?.sku || t("skuMissing")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t("material")}</dt>
              <dd className="text-right">{product.material || t("materialMissing")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{locale === "sr" ? "Održavanje" : "Care"}</dt>
              <dd className="text-right">{product.washing || t("washingMissing")}</dd>
            </div>
          </dl>
          {product.description ? <p className="mt-6 leading-7">{product.description}</p> : null}
          {product.sourceUrl ? (
            <p className="mt-6 text-xs text-muted">
              <a href={product.sourceUrl}>{product.sourceUrl}</a>
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-16">
        <p className="kicker">{locale === "sr" ? "Isti program" : "Same programme"}</p>
        <h2 className="mt-3 text-4xl">{t("related")}</h2>
        <div className="mt-8">
          <ProductGrid products={more} locale={locale} commerce={data.commerce} />
        </div>
        <RecentView slug={product.slug} label={t("recent")} />
      </div>
    </article>
  );
}

export default function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  return (
    <Suspense fallback={<div className="wrap py-16">…</div>}>
      <Body params={params} />
    </Suspense>
  );
}
