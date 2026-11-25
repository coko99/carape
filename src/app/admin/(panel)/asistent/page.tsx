import { requireStaff } from "@/server/admin";
import { assistantAdmin, saveAssistant } from "@/server/features";
import { requireDb } from "@/db";
import { auditLogs, faqs } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function Page() {
  await requireStaff("assistant");
  const data = await assistantAdmin();
  const db = await requireDb();
  const published = await db.select().from(faqs).where(eq(faqs.published, true));
  const unanswered = await db.select().from(auditLogs).where(eq(auditLogs.action, "unanswered"));
  return (
    <div className="grid gap-6">
      <h1 className="text-4xl">AI asistent</h1>
      <p>Bez AI ključa asistent odgovara samo iz kataloga, FAQ-a i podešene dostave. Ne izmišlja cene.</p>
      <p>Poruka u niti: {data.messages}. Nepoznata pitanja: {data.unanswered}.</p>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        await requireStaff("assistant");
        await saveAssistant({
          enabled: formData.get("enabled") === "1",
          welcome: String(formData.get("welcome") || ""),
          dailyLimit: Number(formData.get("limit") || 30),
        });
      }}>
        <label className="flex gap-2"><input type="checkbox" name="enabled" value="1" defaultChecked={data.settings.enabled} /> Uključen</label>
        <textarea name="welcome" defaultValue={data.settings.welcome} />
        <input name="limit" type="number" min={1} defaultValue={data.settings.dailyLimit} />
        <button className="btn w-fit" type="submit">Sačuvaj</button>
      </form>
      <h2 className="text-2xl">Objavljeni FAQ</h2>
      <ul>{published.map((faq) => <li key={faq.id}>{faq.question}</li>)}</ul>
      <h2 className="text-2xl">Bez odgovora</h2>
      <ul>{unanswered.map((row) => <li key={row.id}>{row.metadata}</li>)}</ul>
      <p>AI ključ {process.env.AI_GATEWAY_API_KEY ? "je podešen" : "nije podešen"}.</p>
    </div>
  );
}
