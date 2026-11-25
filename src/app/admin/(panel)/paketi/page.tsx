import { requireStaff } from "@/server/admin";
import { bundleAdminData, saveBundleCampaign } from "@/server/features";
import { formatRsd } from "@/lib/commerce";

export default async function Page() {
  await requireStaff("marketing");
  const data = await bundleAdminData();
  return (
    <div className="grid gap-8">
      <h1 className="text-4xl">Paketi čarapa</h1>
      <form className="grid max-w-xl gap-3" action={async (formData) => {
        "use server";
        await requireStaff("marketing");
        const kind = String(formData.get("kind") || "percent");
        await saveBundleCampaign({
          name: String(formData.get("name") || ""),
          minPairs: Number(formData.get("min") || 0),
          maxPairs: formData.get("max") ? Number(formData.get("max")) : null,
          combine: formData.get("combine") === "1",
          startsAt: formData.get("start") ? new Date(String(formData.get("start"))) : null,
          endsAt: formData.get("end") ? new Date(String(formData.get("end"))) : null,
          active: formData.get("active") === "1",
          rules: [{ kind: kind === "fixed_amount" || kind === "fixed_package" ? kind : "percent", minPairs: Number(formData.get("ruleMin") || 0), value: Number(formData.get("value") || 0) }],
          categoryIds: formData.getAll("category").map(String),
          productIds: String(formData.get("products") || "").split(",").map((item) => item.trim()).filter(Boolean),
        });
      }}>
        <input name="name" placeholder="Naziv kampanje" required />
        <input name="min" type="number" min={1} placeholder="Minimum pari" required />
        <input name="max" type="number" placeholder="Maksimum pari" />
        <input name="ruleMin" type="number" min={1} placeholder="Prag pravila" required />
        <select name="kind"><option value="percent">Procenat</option><option value="fixed_amount">Fiksni iznos u parama</option><option value="fixed_package">Fiksna cena paketa u parama</option></select>
        <input name="value" type="number" min={0} placeholder="Vrednost" required />
        <input name="start" type="datetime-local" />
        <input name="end" type="datetime-local" />
        <label className="flex gap-2"><input type="checkbox" name="combine" value="1" /> Može sa kuponom</label>
        <label className="flex gap-2"><input type="checkbox" name="active" value="1" /> Uključeno</label>
        <select name="category" multiple>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.nameSr}</option>)}</select>
        <input name="products" placeholder="ID proizvoda, odvojeni zarezom" />
        <button className="btn w-fit" type="submit">Sačuvaj kampanju</button>
      </form>
      <ul>
        {data.campaigns.map((campaign) => {
          const sold = data.sold.filter((row) => row.campaignId === campaign.id);
          return <li key={campaign.id}>{campaign.name} · {campaign.active ? "uključeno" : "isključeno"} · prodato paketa {sold.length} · popust {formatRsd(sold.reduce((sum, row) => sum + row.discountMinor, 0))}</li>;
        })}
      </ul>
    </div>
  );
}
