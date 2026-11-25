import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireDb } from "@/db";
import { siteSettings } from "@/db/schema";
import { requireStaff } from "@/server/admin";
import { readSettings } from "@/server/seed";

export default async function Page() {
  const db = await requireDb();
  const settings = await readSettings(db);
  return (
    <>
      <h1 className="text-4xl">Podešavanja</h1>
      <form
        className="mt-6 grid max-w-xl gap-3"
        action={async (formData) => {
          "use server";
          await requireStaff("settings.write");
          const db = await requireDb();
          const current = await readSettings(db);
          const numberOrNull = (key: string) => {
            const raw = String(formData.get(key) || "").trim();
            return raw === "" ? null : Math.round(Number(raw) * 100);
          };
          const next = {
            ...current,
            shippingFlatMinor: numberOrNull("shipping"),
            freeDeliveryMinor: numberOrNull("free"),
            minimumOrderMinor: numberOrNull("minimum"),
            companyPib: String(formData.get("pib") || "") || null,
            companyMb: String(formData.get("mb") || "") || null,
            bankAccount: String(formData.get("bank") || "") || null,
          };
          await db.update(siteSettings).set({ value: JSON.stringify(next), updatedAt: new Date() }).where(eq(siteSettings.key, "store"));
          revalidateTag("catalog", "max");
        }}
      >
        <label className="field"><span>Dostava, RSD</span><input name="shipping" defaultValue={settings.shippingFlatMinor == null ? "" : settings.shippingFlatMinor / 100} /></label>
        <label className="field"><span>Besplatna dostava od, RSD</span><input name="free" defaultValue={settings.freeDeliveryMinor == null ? "" : settings.freeDeliveryMinor / 100} /></label>
        <label className="field"><span>Minimalna porudžbina, RSD</span><input name="minimum" defaultValue={settings.minimumOrderMinor == null ? "" : settings.minimumOrderMinor / 100} /></label>
        <label className="field"><span>PIB</span><input name="pib" defaultValue={settings.companyPib ?? ""} /></label>
        <label className="field"><span>Matični broj</span><input name="mb" defaultValue={settings.companyMb ?? ""} /></label>
        <label className="field"><span>Tekući račun</span><input name="bank" defaultValue={settings.bankAccount ?? ""} /></label>
        <button className="btn w-fit" type="submit">Sačuvaj</button>
      </form>
    </>
  );
}
