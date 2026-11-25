import { formatRsd } from "@/lib/commerce";
import { requireStaff } from "@/server/admin";
import { addWarehouse, adjustInventory, inventoryAnalytics, inventoryTable, releaseExpiredReservations, setVariantCost } from "@/server/features";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; size?: string; low?: string }> }) {
  const { session } = await requireStaff("inventory");
  const query = await searchParams;
  await releaseExpiredReservations();
  const rows = await inventoryTable({ q: query.q, size: query.size, low: query.low === "1" });
  const stats = await inventoryAnalytics();
  return (
    <div className="grid gap-8">
      <h1 className="text-4xl">Lager</h1>
      <p>Raspoloživo = fizičko prodajno stanje − aktivne rezervacije. Oštećeno nije u toj količini. Prazno stanje znači da količina nije uneta.</p>
      <form className="flex flex-wrap gap-2">
        <input name="q" placeholder="Naziv ili šifra" defaultValue={query.q ?? ""} />
        <input name="size" placeholder="Veličina" defaultValue={query.size ?? ""} />
        <label className="flex gap-2"><input type="checkbox" name="low" value="1" defaultChecked={query.low === "1"} /> Nisko stanje</label>
        <button className="btn" type="submit">Filter</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th>Proizvod</th><th>Veličina</th><th>Boja</th><th>Šifra</th><th>Fizičko</th><th>Rezervisano</th><th>Oštećeno</th><th>Nabavna</th></tr></thead>
          <tbody>
            {rows.slice(0, 80).map((row) => (
              <tr key={row.variantId} className="border-t border-line">
                <td>{row.name}</td><td>{row.size}</td><td>{row.color ?? "—"}</td><td>{row.sku ?? "—"}</td>
                <td>{row.stockQuantity ?? "nije uneto"}</td><td>{row.reservedQuantity}</td><td>{row.damagedQuantity}</td>
                <td>{row.costMinor == null ? "nije uneta" : formatRsd(row.costMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        const staff = await requireStaff("inventory");
        await adjustInventory({
          variantId: String(formData.get("variant") || ""),
          delta: Number(formData.get("delta") || 0),
          reason: String(formData.get("reason") || ""),
          actorId: staff.session.user.id,
          damaged: formData.get("damaged") === "1",
          warehouseId: String(formData.get("warehouse") || ""),
        });
      }}>
        <h2 className="text-2xl">Korekcija</h2>
        <input name="variant" placeholder="ID varijante" required />
        <input name="delta" type="number" required />
        <input name="reason" placeholder="Razlog" required />
        <input name="warehouse" placeholder="Magacin, opciono" />
        <label className="flex gap-2"><input type="checkbox" name="damaged" value="1" /> Oštećeno</label>
        <button className="btn w-fit" type="submit">Sačuvaj</button>
      </form>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        await requireStaff("finance");
        const cost = String(formData.get("cost") || "");
        await setVariantCost(String(formData.get("variant") || ""), cost === "" ? null : Math.round(Number(cost) * 100));
      }}>
        <h2 className="text-2xl">Nabavna cena</h2>
        <input name="variant" placeholder="ID varijante" required />
        <input name="cost" placeholder="RSD, prazno briše" />
        <button className="btn w-fit" type="submit">Sačuvaj</button>
      </form>
      <form action={async (formData) => { "use server"; await requireStaff("inventory"); await addWarehouse(String(formData.get("name") || "")); }}>
        <input name="name" placeholder="Novi magacin" />
        <button className="btn ml-2" type="submit">Dodaj</button>
      </form>
      <section>
        <h2 className="text-2xl">Analitika iz stvarnih porudžbina</h2>
        <p>Vrednost zaliha: {stats.unvalued ? "nepotpuna, nema nabavne cene za sve prebrojane varijante" : formatRsd(stats.stockValueMinor)}. Bez nabavne: {stats.unvalued}.</p>
        <p>Najprodavanije: {stats.fast.map(([name, qty]) => `${name} (${qty})`).join(", ") || "nema prodaje"}</p>
        <p>Veličine: {stats.sizes.map(([size, qty]) => `${size} (${qty})`).join(", ") || "nema"}</p>
        <p>Boje: {stats.colors.map(([color, qty]) => `${color} (${qty})`).join(", ") || "boja nije vođena na stavkama"}</p>
        <p>Dopuna: {stats.replenish.length}</p>
      </section>
      <section>
        <h2 className="text-2xl">Kretanja</h2>
        <ul>{stats.movements.map((move) => <li key={move.id}>{move.createdAt.toISOString()} · {move.type} · {move.quantityDelta} · {move.reason ?? move.note ?? ""} · {move.actorId ?? "sistem"}</li>)}</ul>
      </section>
      <p className="text-sm">Prijavljen: {session.user.email}</p>
    </div>
  );
}
