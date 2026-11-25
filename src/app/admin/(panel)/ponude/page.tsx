import { requireStaff } from "@/server/admin";
import { convertQuote, createQuotation, transitionQuote } from "@/server/features";
import { requireDb } from "@/db";
import { companies, quotations } from "@/db/schema";
import { desc } from "drizzle-orm";
import { formatRsd } from "@/lib/commerce";
import type { QuoteStatus } from "@/lib/quote-rules";

export default async function Page() {
  const { session } = await requireStaff("quotes");
  const db = await requireDb();
  const rows = await db.select().from(quotations).orderBy(desc(quotations.createdAt));
  const firms = await db.select().from(companies);
  return (
    <div className="grid gap-6">
      <h1 className="text-4xl">Ponude</h1>
      <p>Ponuda nije fiskalni račun i nije faktura.</p>
      <form className="grid max-w-xl gap-2" action={async (formData) => {
        "use server";
        const staff = await requireStaff("quotes");
        await createQuotation({
          actorId: staff.session.user.id,
          buyerName: String(formData.get("buyer") || ""),
          buyerEmail: String(formData.get("email") || ""),
          buyerPib: String(formData.get("pib") || ""),
          buyerAddress: String(formData.get("address") || ""),
          companyId: String(formData.get("company") || "") || null,
          designId: String(formData.get("design") || "") || null,
          validUntil: new Date(String(formData.get("until") || "")),
          shippingMinor: formData.get("shipping") === "" ? null : Math.round(Number(formData.get("shipping")) * 100),
          taxMinor: formData.get("tax") === "" ? null : Math.round(Number(formData.get("tax")) * 100),
          paymentTerms: String(formData.get("terms") || ""),
          deliveryNote: String(formData.get("delivery") || ""),
          notes: String(formData.get("notes") || ""),
          lines: [{
            description: String(formData.get("item") || ""),
            sku: String(formData.get("sku") || ""),
            variantId: String(formData.get("variant") || "") || null,
            quantity: Number(formData.get("qty") || 0),
            unitPriceMinor: Math.round(Number(formData.get("price") || 0) * 100),
            discountMinor: Math.round(Number(formData.get("discount") || 0) * 100),
          }],
        });
      }}>
        <select name="company"><option value="">Bez firme</option>{firms.map((firm) => <option key={firm.id} value={firm.id}>{firm.name}</option>)}</select>
        <input name="buyer" placeholder="Kupac" required />
        <input name="email" type="email" required />
        <input name="pib" placeholder="PIB" />
        <input name="address" placeholder="Adresa" />
        <input name="design" placeholder="ID dizajna, opciono" />
        <input name="until" type="date" required />
        <input name="item" placeholder="Stavka" required />
        <input name="sku" placeholder="Šifra" />
        <input name="variant" placeholder="ID varijante" />
        <input name="qty" type="number" min={1} required />
        <input name="price" type="number" min={0} step="0.01" required />
        <input name="discount" type="number" min={0} step="0.01" />
        <input name="shipping" type="number" min={0} step="0.01" placeholder="Dostava RSD, prazno ako nije poznata" />
        <input name="tax" type="number" min={0} step="0.01" placeholder="Porez RSD, prazno ako nije unet" />
        <input name="terms" placeholder="Uslovi plaćanja" />
        <input name="delivery" placeholder="Rok isporuke" />
        <textarea name="notes" placeholder="Napomena" />
        <button className="btn w-fit" type="submit">Nacrt</button>
      </form>
      <ul className="grid gap-3">
        {rows.map((quote) => (
          <li key={quote.id} className="border border-line p-3">
            <p>{quote.number} · {quote.status} · {quote.buyerName} · {formatRsd(quote.totalMinor)}</p>
            <p><a href={`/admin/ponude/${quote.id}/pdf`}>PDF</a> · <a href={`/ponuda/${quote.token}`}>Link za kupca</a></p>
            {quote.status === "accepted" && !quote.orderId ? (
              <form action={async () => {
                "use server";
                const staff = await requireStaff("quotes");
                await convertQuote(quote.id, staff.session.user.id);
              }}><button className="btn mt-2" type="submit">Pretvori u porudžbinu</button></form>
            ) : null}
            <form action={async (formData) => {
              "use server";
              const staff = await requireStaff("quotes");
              await transitionQuote(quote.id, String(formData.get("status")) as QuoteStatus, staff.session.user.id);
            }}>
              <select name="status" defaultValue={quote.status}>
                <option value="draft">Nacrt</option>
                <option value="pending_approval">Čeka odobrenje</option>
                <option value="sent">Poslata</option>
                <option value="rejected">Odbijena</option>
                <option value="expired">Istekla</option>
              </select>
              <button className="btn ml-2" type="submit">Status</button>
            </form>
          </li>
        ))}
      </ul>
      <p>{session.user.email}</p>
    </div>
  );
}
