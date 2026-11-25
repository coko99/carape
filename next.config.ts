import type { NextConfig } from "next";
import fs from "node:fs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

function legacyRedirects() {
  const fixed = [
    { source: "/shop", destination: "/proizvodi", permanent: true },
    { source: "/trgovina", destination: "/proizvodi", permanent: true },
    { source: "/cart", destination: "/korpa", permanent: true },
    { source: "/kosarica", destination: "/korpa", permanent: true },
    { source: "/checkout", destination: "/placanje", permanent: true },
    { source: "/placanje", destination: "/placanje", permanent: false },
    { source: "/contact", destination: "/kontakt", permanent: true },
    { source: "/about", destination: "/o-nama", permanent: true },
    { source: "/nacrtaj-carapu", destination: "/po-meri", permanent: true },
    { source: "/saradnja", destination: "/po-meri", permanent: true },
    { source: "/my-account", destination: "/nalog", permanent: true },
    { source: "/moj-racun", destination: "/nalog", permanent: true },
    { source: "/privacy-policy", destination: "/privatnost", permanent: true },
    { source: "/refund_returns", destination: "/reklamacije", permanent: true },
  ].filter((rule) => rule.source !== rule.destination);
  const file = "data/migration/categories.json";
  if (!fs.existsSync(file)) return fixed;
  const categories = JSON.parse(fs.readFileSync(file, "utf8")) as Array<{
    sourceId: number;
    parentSourceId: number;
    slug: string;
  }>;
  const byId = new Map(categories.map((category) => [category.sourceId, category]));
  const categoryRules = categories.flatMap((category) => {
    const rules = [
      {
        source: `/kategorija-proizvoda/${category.slug}`,
        destination: `/kategorija/${category.slug}`,
        permanent: true,
      },
    ];
    const parent = byId.get(category.parentSourceId);
    if (parent) {
      rules.push({
        source: `/kategorija-proizvoda/${parent.slug}/${category.slug}`,
        destination: `/kategorija/${category.slug}`,
        permanent: true,
      });
    }
    return rules;
  });
  return [...fixed, ...categoryRules];
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@electric-sql/pglite", "@neondatabase/serverless", "ws"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "proizvodnjacarapa.com" }],
  },
  async redirects() {
    return legacyRedirects();
  },
};

export default withNextIntl(nextConfig);
