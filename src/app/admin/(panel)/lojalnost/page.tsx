import { requireStaff } from "@/server/admin";
import { loyaltyProgram, loyaltyState, recordLoyalty, saveLoyaltyProgram } from "@/server/features";
import { requireDb } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function Page() {
  const { session } = await requireStaff("loyalty");
  const program = await loyaltyProgram();
  return (
    <div className="grid gap-6">
      <h1 className="text-4xl">Program lojalnosti</h1>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        await requireStaff("loyalty");
        await saveLoyaltyProgram({
          enabled: formData.get("enabled") === "1",
          minorPerPoint: Math.round(Number(formData.get("spend") || 0) * 100),
          pointsPerUnit: Number(formData.get("points") || 1),
          minorPerUnit: Math.round(Number(formData.get("value") || 0) * 100),
          minRedeemPoints: Number(formData.get("min") || 0),
          maxSharePercent: Number(formData.get("max") || 100),
          activateOn: formData.get("when") === "delivered" ? "delivered" : "paid",
          expiryDays: formData.get("expiry") ? Number(formData.get("expiry")) : null,
          combineWithCoupons: formData.get("coupons") === "1",
          combineWithBundles: formData.get("bundles") === "1",
        });
      }}>
        <label className="flex gap-2"><input type="checkbox" name="enabled" value="1" defaultChecked={program.enabled} /> Uključen</label>
        <label className="field"><span>RSD za 1 bod</span><input name="spend" type="number" min={0} step="0.01" defaultValue={program.minorPerPoint / 100} /></label>
        <label className="field"><span>Bodova u jednom koraku</span><input name="points" type="number" min={1} defaultValue={program.pointsPerUnit} /></label>
        <label className="field"><span>RSD po tom koraku</span><input name="value" type="number" min={0} step="0.01" defaultValue={program.minorPerUnit / 100} /></label>
        <label className="field"><span>Minimum bodova</span><input name="min" type="number" min={0} defaultValue={program.minRedeemPoints} /></label>
        <label className="field"><span>Maksimalni udeo računa %</span><input name="max" type="number" min={0} max={100} defaultValue={program.maxSharePercent} /></label>
        <select name="when" defaultValue={program.activateOn}><option value="paid">Posle plaćanja</option><option value="delivered">Posle isporuke</option></select>
        <input name="expiry" type="number" placeholder="Istek dana, prazno isključuje" defaultValue={program.expiryDays ?? ""} />
        <label className="flex gap-2"><input type="checkbox" name="coupons" value="1" defaultChecked={program.combineWithCoupons} /> Sa kuponom</label>
        <label className="flex gap-2"><input type="checkbox" name="bundles" value="1" defaultChecked={program.combineWithBundles} /> Sa paketom</label>
        <button className="btn w-fit" type="submit">Sačuvaj pravila</button>
      </form>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        const staff = await requireStaff("loyalty");
        const db = await requireDb();
        const [account] = await db.select().from(user).where(eq(user.email, String(formData.get("email") || "")));
        if (!account) return;
        const points = Number(formData.get("points") || 0);
        await recordLoyalty({
          userId: account.id,
          type: "adjustment",
          points,
          key: `adjust:${crypto.randomUUID()}`,
          reason: String(formData.get("reason") || ""),
          actorId: staff.session.user.id,
        });
      }}>
        <h2 className="text-2xl">Ručna izmena</h2>
        <input name="email" type="email" required />
        <input name="points" type="number" required placeholder="Bodovi, minus skida" />
        <input name="reason" required placeholder="Razlog" />
        <button className="btn w-fit" type="submit">Evidentiraj</button>
      </form>
      <p>Pregled poslednjeg naloga nije prikazan dok ne unesete imejl u nalogu kupca. {session.user.email}</p>
    </div>
  );
}

export async function accountPoints(userId: string) {
  return loyaltyState(userId);
}
