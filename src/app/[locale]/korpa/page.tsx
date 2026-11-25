import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatRsd } from "@/lib/commerce";
import { updateCartAction } from "@/server/actions";
import { getCartLines } from "@/server/cart";
import { cartBundleViews } from "@/server/features";
import { quoteShipping, orderTotal } from "@/lib/commerce";
import { readSettings } from "@/server/seed";
import { requireDb } from "@/db";
import { takeLocale } from "@/i18n/locale";

async function CartBody({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  const t = await getTranslations("cart");
  let lines: Awaited<ReturnType<typeof getCartLines>> = [];
  let bundles: Awaited<ReturnType<typeof cartBundleViews>> = [];
  try {
    lines = await getCartLines();
    bundles = await cartBundleViews();
  } catch {
    lines = [];
    bundles = [];
  }
  if (!lines.length && !bundles.length) {
    return (
      <div className="wrap py-16">
        <h1 className="text-5xl">{t("title")}</h1>
        <p className="mt-4">{t("empty")}</p>
        <Link className="btn mt-6" href="/proizvodi">{locale === "sr" ? "Nazad u katalog" : "Back to the shop"}</Link>
      </div>
    );
  }
  const bundleGoods = bundles.reduce((sum, bundle) => sum + (bundle.quote.ok ? bundle.quote.originalMinor : 0), 0);
  const bundleDiscount = bundles.reduce((sum, bundle) => sum + (bundle.quote.ok ? bundle.quote.discountMinor : 0), 0);
  const goods = lines.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0) + bundleGoods;
  let shipping = { priceMinor: null as number | null, status: "pending_price" };
  try {
    const db = await requireDb();
    const settings = await readSettings(db);
    shipping = quoteShipping({ goodsMinor: goods, discountMinor: bundleDiscount, flatMinor: settings.shippingFlatMinor, freeThresholdMinor: settings.freeDeliveryMinor });
  } catch {
    shipping = { priceMinor: null, status: "pending_price" };
  }
  const totals = orderTotal({ goodsMinor: goods, discountMinor: bundleDiscount, shippingMinor: shipping.priceMinor });
  return (
    <div className="wrap grid gap-10 py-10 md:grid-cols-[1.4fr_0.6fr]">
      <div>
        <h1 className="text-5xl">{t("title")}</h1>
        <ul className="mt-8 divide-y divide-line">
          {lines.map((line) => (
            <li key={line.itemId} className="flex items-center justify-between gap-4 py-4">
              <div>
                <Link href={{ pathname: "/proizvod/[slug]", params: { slug: line.slug } }} className="text-lg">{line.name}</Link>
                <p className="text-sm text-muted">{line.size} · {formatRsd(line.priceMinor, locale)}</p>
              </div>
              <form action={async (formData) => {
                "use server";
                const remove = formData.get("remove") === "1";
                await updateCartAction(String(formData.get("id")), remove ? 0 : Number(formData.get("quantity")));
              }} className="flex items-center gap-2">
                <input type="hidden" name="id" value={line.itemId} />
                <input name="quantity" type="number" min={1} max={99} defaultValue={line.quantity} className="w-16 border border-line px-2 py-1" aria-label={locale === "sr" ? "Količina" : "Quantity"} />
                <button className="text-sm underline" type="submit">{locale === "sr" ? "Sačuvaj" : "Save"}</button>
                <button className="text-sm underline" type="submit" name="remove" value="1">{t("remove")}</button>
              </form>
            </li>
          ))}
        </ul>
        {bundles.map((bundle) => (
          <section key={bundle.bundleId} className="mt-6 border border-line p-4">
            <h2 className="text-2xl">{bundle.name}</h2>
            <ul>
              {bundle.items.map((item) => <li key={item.id}>{item.name} · {item.size} × {item.quantity}</li>)}
            </ul>
            {bundle.quote.ok ? <p>Paket {formatRsd(bundle.quote.finalMinor, locale)} · popust {formatRsd(bundle.quote.discountMinor, locale)}</p> : <p>Paket više ne ispunjava pravila kampanje.</p>}
          </section>
        ))}
      </div>
      <aside className="h-fit border border-line bg-paper-2 p-5">
        <p className="flex justify-between"><span>{t("goods")}</span><span>{formatRsd(goods, locale)}</span></p>
        {bundleDiscount > 0 ? <p className="mt-2 flex justify-between"><span>Paket</span><span>−{formatRsd(bundleDiscount, locale)}</span></p> : null}
        <p className="mt-2 flex justify-between"><span>{t("shipping")}</span><span>{shipping.priceMinor == null ? t("shippingPending") : formatRsd(shipping.priceMinor, locale)}</span></p>
        <p className="mt-4 flex justify-between text-lg"><span>{totals.totalKnown ? t("totalKnown") : t("total")}</span><span>{formatRsd(totals.totalMinor, locale)}</span></p>
        <Link className="btn mt-6 w-full" href="/placanje">{t("checkout")}</Link>
      </aside>
    </div>
  );
}

export default function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  return <Suspense fallback={<div className="wrap py-16">…</div>}><CartBody params={params} /></Suspense>;
}
