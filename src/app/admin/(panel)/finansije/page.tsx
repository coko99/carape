import { requireStaff } from "@/server/admin";
import { financeData } from "@/server/features";
import { formatRsd } from "@/lib/commerce";

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireStaff("finance");
  const query = await searchParams;
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getFullYear(), to.getMonth(), 1);
  const data = await financeData(from, to);
  const summary = data.summary;
  const max = Math.max(1, ...data.orders.map((order) => order.goodsMinor));
  return (
    <div className="grid gap-6">
      <h1 className="text-4xl">Finansije i analitika</h1>
      <form className="flex gap-2">
        <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} />
        <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} />
        <button className="btn" type="submit">Period</button>
      </form>
      <p>Prethodni period iste dužine: {data.previousCount} porudžbina, roba {formatRsd(data.previousGoods)}.</p>
      <dl className="grid gap-2 md:grid-cols-3">
        <div>Promet robe {formatRsd(summary.revenueMinor)}</div>
        <div>Plaćeno {formatRsd(summary.paidRevenueMinor)}</div>
        <div>Na čekanju {formatRsd(summary.pendingMinor)}</div>
        <div>Otkazano {formatRsd(summary.canceledMinor)}</div>
        <div>Refundirano {formatRsd(summary.refundedMinor)}</div>
        <div>Neto {formatRsd(summary.netMinor)}</div>
        <div>Nabavna {summary.cogsMinor == null ? "nepotpuna" : formatRsd(summary.cogsMinor)}</div>
        <div>Procenjena bruto marža {summary.estimatedGrossProfitMinor == null ? "nepotpuna" : formatRsd(summary.estimatedGrossProfitMinor)}</div>
        <div>Marža % {summary.marginPercent ?? "nepotpuna"}</div>
        <div>Prosek {formatRsd(summary.averageOrderMinor)}</div>
        <div>Porudžbina {summary.orderCount}</div>
        <div>Maloprodaja {formatRsd(summary.retailMinor)}</div>
        <div>Veleprodaja {formatRsd(summary.wholesaleMinor)}</div>
        <div>Popust paketa {formatRsd(summary.bundleDiscountMinor)}</div>
        <div>Popust bodova {formatRsd(summary.loyaltyDiscountMinor)}</div>
      </dl>
      <p>Procenjena bruto marža nije knjigovodstvena dobit. Nedostajuća nabavna cena ostaje prazna.</p>
      <div className="grid gap-1">
        {data.orders.map((order) => (
          <div key={order.id} className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
            <span>{order.number}</span>
            <div className="h-3 bg-moss" style={{ width: `${(order.goodsMinor / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <p><a href={`/admin/finansije/izvoz?from=${from.toISOString()}&to=${to.toISOString()}`}>CSV</a></p>
    </div>
  );
}
