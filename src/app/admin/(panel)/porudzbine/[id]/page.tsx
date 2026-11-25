import { notFound } from "next/navigation";
import { ORDER_STATUSES, formatRsd, type OrderStatus } from "@/lib/commerce";
import { getOrder, transitionOrder } from "@/server/admin";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) notFound();
  return (
    <>
      <h1 className="text-4xl">{data.order.number}</h1>
      <p className="mt-2">{data.order.customerName} · {data.order.email} · {data.order.phone}</p>
      <p>{data.order.line1}, {data.order.postalCode} {data.order.city}</p>
      <p className="mt-2">Status: {data.order.status} · Plaćanje: {data.order.paymentStatus} · Dostava: {data.order.shippingStatus}</p>
      <ul className="mt-6 divide-y divide-line">
        {data.items.map((item) => (
          <li key={item.id} className="py-2">{item.productName} · {item.size} × {item.quantity} · {formatRsd(item.lineTotalMinor)} · {item.stockState}</li>
        ))}
      </ul>
      <form
        className="mt-6 grid max-w-md gap-3"
        action={async (formData) => {
          "use server";
          await transitionOrder({
            orderId: id,
            status: String(formData.get("status")) as OrderStatus,
            tracking: String(formData.get("tracking") || ""),
          });
        }}
      >
        <label className="field">
          <span>Novi status</span>
          <select name="status" defaultValue={data.order.status}>
            {ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="field"><span>Praćenje</span><input name="tracking" defaultValue={data.shipment?.trackingNumber ?? ""} /></label>
        <button className="btn w-fit" type="submit">Sačuvaj</button>
      </form>
    </>
  );
}
