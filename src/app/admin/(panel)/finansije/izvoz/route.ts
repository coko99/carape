import { requireStaff } from "@/server/admin";
import { financeData } from "@/server/features";

export async function GET(request: Request) {
  await requireStaff("finance");
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") || new Date().toISOString());
  const to = new Date(url.searchParams.get("to") || new Date().toISOString());
  const data = await financeData(from, to);
  const header = "broj,kanal,status,placanje,roba,popust,paket,bodovi,ukupno,refund,nabavna";
  const lines = data.orders.map((order) => [order.number, order.channel, order.status, order.paymentStatus, order.goodsMinor, order.discountMinor, order.bundleDiscountMinor, order.loyaltyDiscountMinor, order.totalMinor].join(","));
  return new Response([header, ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=finansije.csv" },
  });
}
