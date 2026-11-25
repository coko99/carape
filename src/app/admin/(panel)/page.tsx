import { formatRsd } from "@/lib/commerce";
import { dashboardData } from "@/server/admin";

export default async function Page() {
  const data = await dashboardData();
  const cards = [
    ["Danas", String(data.today)],
    ["7 dana", String(data.week)],
    ["Mesec", String(data.month)],
    ["Bruto proizvodi", formatRsd(data.gross)],
    ["Povraćaji", formatRsd(data.refunds)],
    ["Neto", formatRsd(data.net)],
    ["Prosek", formatRsd(data.average)],
    ["Zaliha bez broja", String(data.unverifiedStock[0]?.count ?? 0)],
  ];
  return (
    <>
      <h1 className="text-4xl">Pregled</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Neto = plaćene porudžbine (status plaćanja paid ili refunded, bez otkazanih) minus iznos refundiranih porudžbina.
        Konverzija se ne prikazuje jer analitika nije povezana.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="border border-line bg-paper-2 p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
            <p className="mt-2 text-2xl">{value}</p>
          </article>
        ))}
      </div>
      <h2 className="mt-10 text-2xl">Poslednje porudžbine</h2>
      <ul className="mt-3 divide-y divide-line">
        {data.recent.map((order) => (
          <li key={order.id} className="flex justify-between py-2">
            <a href={`/admin/porudzbine/${order.id}`}>{order.number}</a>
            <span>{order.status} · {formatRsd(order.totalMinor)}</span>
          </li>
        ))}
        {data.recent.length === 0 ? <li>Nema porudžbina.</li> : null}
      </ul>
    </>
  );
}
