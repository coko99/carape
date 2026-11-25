import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { formatRsd } from "@/lib/commerce";
import { takeLocale } from "@/i18n/locale";

export default async function OrderPage({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const { number } = await params;
  const locale = await takeLocale(params);
  const t = await getTranslations("order");
  const db = await requireDb();
  const [order] = await db.select().from(orders).where(eq(orders.number, number));
  if (!order) notFound();
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return (
    <div className="wrap max-w-3xl py-12">
      <p className="text-xs uppercase tracking-[0.16em] text-moss">{order.number}</p>
      <h1 className="mt-2 text-5xl">{t("title")}</h1>
      <p className="mt-3 text-sm">{t("notReceipt")}</p>
      <p className="mt-2 text-sm text-muted">{t("track")}</p>
      <ul className="mt-8 divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between py-3">
            <span>{item.productName} · {item.size} × {item.quantity}</span>
            <span>{formatRsd(item.lineTotalMinor, locale)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4">{order.shippingStatus === "pending_price" ? (locale === "sr" ? "Dostava čeka potvrdu." : "Delivery awaits confirmation.") : null}</p>
    </div>
  );
}
