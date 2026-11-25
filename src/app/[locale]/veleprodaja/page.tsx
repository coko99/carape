import { headers } from "next/headers";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { takeLocale } from "@/i18n/locale";
import { requireDb } from "@/db";
import { orders, shoppingLists } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { formatRsd } from "@/lib/commerce";
import { companyForUser, registerCompany, repeatOrder, saveShoppingList, tiersForCompany } from "@/server/features";
import { resolveUnitPrice } from "@/lib/pricing";
import { Link } from "@/i18n/navigation";

async function Body({ params }: { params: Promise<{ locale: string }> }) {
  await takeLocale(params);
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) {
    return (
      <div className="wrap py-16">
        <h1 className="text-5xl">Veleprodaja</h1>
        <p className="mt-4">Nalog firme traži prijavu. <Link href="/prijava">Prijava</Link></p>
      </div>
    );
  }
  const company = await companyForUser(session.user.id);
  const db = await requireDb();
  const history = company ? await db.select().from(orders).where(eq(orders.email, session.user.email)) : [];
  const tiers = company?.status === "approved" ? await tiersForCompany(company.id) : [];
  const lists = company?.status === "approved" ? await db.select().from(shoppingLists).where(eq(shoppingLists.companyId, company.id)) : [];
  return (
    <div className="wrap py-10">
      <h1 className="text-5xl">Veleprodaja</h1>
      {!company ? (
        <form className="mt-8 grid max-w-xl gap-3" action={async (formData) => {
          "use server";
          await registerCompany({
            userId: session.user.id,
            name: String(formData.get("name") || ""),
            pib: String(formData.get("pib") || ""),
            registrationNumber: String(formData.get("mb") || ""),
            line1: String(formData.get("line1") || ""),
            city: String(formData.get("city") || ""),
            postalCode: String(formData.get("postal") || ""),
            contactName: String(formData.get("contact") || ""),
            phone: String(formData.get("phone") || ""),
            email: String(formData.get("email") || session.user.email),
            website: String(formData.get("website") || ""),
          });
        }}>
          <p>Zahtev čeka odobrenje. Veleprodajne cene nisu vidljive pre odobrenja.</p>
          <label className="field"><span>Naziv firme</span><input name="name" required /></label>
          <label className="field"><span>PIB</span><input name="pib" required inputMode="numeric" /></label>
          <label className="field"><span>Matični broj</span><input name="mb" required inputMode="numeric" /></label>
          <label className="field"><span>Adresa</span><input name="line1" required /></label>
          <label className="field"><span>Grad</span><input name="city" required /></label>
          <label className="field"><span>Poštanski broj</span><input name="postal" required inputMode="numeric" /></label>
          <label className="field"><span>Kontakt osoba</span><input name="contact" required /></label>
          <label className="field"><span>Telefon</span><input name="phone" required /></label>
          <label className="field"><span>Imejl</span><input name="email" type="email" required defaultValue={session.user.email} /></label>
          <label className="field"><span>Sajt</span><input name="website" /></label>
          <button className="btn w-fit" type="submit">Pošalji zahtev</button>
        </form>
      ) : (
        <div className="mt-8 grid gap-6">
          <p>Status naloga: {company.status}. {company.status !== "approved" ? "Cene iz cenovnika nisu dostupne." : `Rok plaćanja: ${company.paymentTermsDays ?? "nije podešen"} dana.`}</p>
          <p>{company.name} · PIB {company.pib} · MB {company.registrationNumber}</p>
          {company.status === "approved" ? (
            <>
              <h2 className="text-3xl">Cenovnik</h2>
              {tiers.length === 0 ? <p>Cenovnik još nije dodeljen. Plaća se maloprodajna cena dok administrator ne unese pragove.</p> : (
                <ul>{tiers.map((tier) => <li key={tier.id}>{tier.variantId} od {tier.minQuantity} pari · {formatRsd(resolveUnitPrice({ retailMinor: tier.priceMinor, quantity: tier.minQuantity, approved: true, tiers: [tier] }).unitMinor)}</li>)}</ul>
              )}
              <h2 className="text-3xl">Porudžbine</h2>
              <ul>{history.map((order) => (
                <li key={order.id} className="flex gap-4 py-2">
                  <span>{order.number} · {order.channel} · {formatRsd(order.totalMinor)}</span>
                  <form action={async () => { "use server"; await repeatOrder(session.user.email, order.id); }}><button className="underline" type="submit">Ponovi</button></form>
                </li>
              ))}</ul>
              <h2 className="text-3xl">Sačuvane liste</h2>
              {lists.length === 0 ? <p>Nema sačuvanih lista.</p> : <ul>{lists.map((list) => <li key={list.id}>{list.name}</li>)}</ul>}
              <form action={async (formData) => { "use server"; await saveShoppingList(company.id, String(formData.get("list") || "Lista"), []); }}>
                <label className="field"><span>Nova lista</span><input name="list" required /></label>
                <button className="btn mt-3" type="submit">Sačuvaj praznu listu</button>
              </form>
              <p><Link href="/kontakt">Direktan kontakt sa prodajom</Link></p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <Suspense fallback={<div className="wrap py-16">…</div>}><Body params={params} /></Suspense>;
}
