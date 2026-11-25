import { Suspense } from "react";
import { notFound } from "next/navigation";
import { takeLocale } from "@/i18n/locale";
import { acceptQuoteToken, openQuoteToken } from "@/server/features";
import { formatRsd } from "@/lib/commerce";

async function Body({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const locale = await takeLocale(params);
  const { token } = await params;
  const opened = await openQuoteToken(token);
  if (!opened) notFound();
  return (
    <div className="wrap max-w-3xl py-12">
      <h1 className="text-5xl">Ponuda {opened.quote.number}</h1>
      <p className="mt-2">Ovo nije fiskalni račun i nije faktura.</p>
      <p className="mt-4">{opened.quote.buyerName} · status {opened.quote.status}</p>
      <ul className="mt-6 divide-y divide-line">
        {opened.items.map((item) => <li key={item.id} className="py-2">{item.description} × {item.quantity} · {formatRsd(item.lineTotalMinor, locale)}</li>)}
      </ul>
      <p className="mt-4">Ukupno {formatRsd(opened.quote.totalMinor, locale)}. Dostava: {opened.quote.shippingMinor == null ? "nije uneta" : formatRsd(opened.quote.shippingMinor, locale)}.</p>
      {opened.quote.status === "viewed" || opened.quote.status === "sent" ? (
        <form className="mt-6" action={async () => { "use server"; await acceptQuoteToken(token); }}>
          <button className="btn" type="submit">Prihvatam ponudu</button>
        </form>
      ) : null}
      {opened.quote.orderId ? <p className="mt-4">Ponuda je pretvorena u porudžbinu.</p> : null}
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  return <Suspense fallback={<div className="wrap py-16">…</div>}><Body params={params} /></Suspense>;
}
