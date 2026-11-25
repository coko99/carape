import { and, eq, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { orders } from "@/db/schema";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ number?: string; email?: string }>;
}) {
  const query = await searchParams;
  let result: { status: string; paymentStatus: string; shippingStatus: string } | null = null;
  if (query.number && query.email) {
    const db = await requireDb();
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.number, query.number), sql`lower(${orders.email}) = ${query.email.toLowerCase()}`));
    if (order) result = { status: order.status, paymentStatus: order.paymentStatus, shippingStatus: order.shippingStatus };
  }
  return (
    <div className="wrap max-w-xl py-12">
      <h1 className="text-5xl">Praćenje</h1>
      <form className="mt-6 grid gap-3">
        <label className="field"><span>Broj</span><input name="number" defaultValue={query.number} required /></label>
        <label className="field"><span>Email</span><input name="email" type="email" defaultValue={query.email} required /></label>
        <button className="btn w-fit" type="submit">Prikaži</button>
      </form>
      {query.number ? <p className="mt-6" role="status">{result ? `${result.status} · ${result.paymentStatus} · ${result.shippingStatus}` : "Nema poklapanja."}</p> : null}
    </div>
  );
}
