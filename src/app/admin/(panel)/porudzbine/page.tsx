import { formatDate, formatRsd } from "@/lib/commerce";
import { listOrders } from "@/server/admin";

export default async function Page() {
  const rows = await listOrders();
  return (
    <>
      <h1 className="text-4xl">Porudžbine</h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="py-2">Broj</th><th>Status</th><th>Plaćanje</th><th>Iznos</th><th>Datum</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id} className="border-b border-line">
              <td className="py-2"><a href={`/admin/porudzbine/${order.id}`}>{order.number}</a></td>
              <td>{order.status}</td>
              <td>{order.paymentStatus}</td>
              <td>{formatRsd(order.totalMinor)}</td>
              <td>{formatDate(order.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
