import { requireStaff } from "@/server/admin";
import { savePriceTier, setCompanyStatus, setCompanyTerms, wholesaleAdmin } from "@/server/features";
import { formatRsd } from "@/lib/commerce";
import { inquiries } from "@/db/schema";
import { requireDb } from "@/db";
import { eq } from "drizzle-orm";

export default async function Page() {
  const { session } = await requireStaff("wholesale");
  const data = await wholesaleAdmin();
  const db = await requireDb();
  const leads = await db.select().from(inquiries).where(eq(inquiries.type, "wholesale"));
  const revenue = data.b2bOrders.filter((order) => order.status !== "canceled").reduce((sum, order) => sum + order.goodsMinor, 0);
  return (
    <div className="grid gap-6">
      <h1 className="text-4xl">Veleprodaja</h1>
      <p>Prihod veleprodajnih porudžbina: {formatRsd(revenue)}</p>
      {data.rows.map((company) => (
        <article key={company.id} className="border border-line p-4">
          <h2 className="text-2xl">{company.name}</h2>
          <p>{company.status} · PIB {company.pib} · {company.email} · {company.city}</p>
          <form className="mt-3 flex flex-wrap gap-2" action={async (formData) => {
            "use server";
            const staff = await requireStaff("wholesale");
            await setCompanyStatus(company.id, String(formData.get("status")) as "approved", staff.session.user.id);
          }}>
            <select name="status" defaultValue={company.status}>
              <option value="pending">Na čekanju</option>
              <option value="approved">Odobreno</option>
              <option value="rejected">Odbijeno</option>
              <option value="suspended">Suspendovano</option>
            </select>
            <button className="btn" type="submit">Sačuvaj status</button>
          </form>
          <form className="mt-3 grid gap-2 md:grid-cols-4" action={async (formData) => {
            "use server";
            await requireStaff("wholesale");
            await savePriceTier({ companyId: company.id, variantId: String(formData.get("variant")), minQuantity: Number(formData.get("min")), priceMinor: Math.round(Number(formData.get("price")) * 100) });
          }}>
            <input name="variant" placeholder="ID varijante" required />
            <input name="min" type="number" min={1} placeholder="Od pari" required />
            <input name="price" type="number" min={0} step="0.01" placeholder="Cena RSD" required />
            <button className="btn" type="submit">Cena</button>
          </form>
          <form className="mt-3 flex gap-2" action={async (formData) => {
            "use server";
            await requireStaff("wholesale");
            await setCompanyTerms(company.id, formData.get("days") ? Number(formData.get("days")) : null, formData.get("min") ? Math.round(Number(formData.get("min")) * 100) : null);
          }}>
            <input name="days" type="number" placeholder="Rok dana" defaultValue={company.paymentTermsDays ?? ""} />
            <input name="min" type="number" placeholder="Minimum RSD" defaultValue={company.minOrderMinor != null ? company.minOrderMinor / 100 : ""} />
            <button className="btn" type="submit">Uslovi</button>
          </form>
        </article>
      ))}
      <h2 className="text-2xl">Upiti</h2>
      <ul>{leads.map((lead) => <li key={lead.id}>{lead.organization} · {lead.email} · {lead.status}</li>)}</ul>
      <p>Prijavljen: {session.user.email}</p>
    </div>
  );
}
