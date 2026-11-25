import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { takeLocale } from "@/i18n/locale";
import { requireDb } from "@/db";
import { orders } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { formatDate, formatRsd } from "@/lib/commerce";
import { loyaltyState } from "@/server/features";
import { SignOut } from "@/components/sign-out";

async function Points({ userId }: { userId: string }) {
  const state = await loyaltyState(userId);
  if (!state.balances.ok) return <p>Stanje bodova nije usklađeno. Obratite se prodavnici.</p>;
  return (
    <div className="mt-4">
      <p>Raspoloživo: {state.balances.available}</p>
      <p>Na čekanju: {state.balances.pending}</p>
      <ul className="mt-3 text-sm">
        {state.rows.map((row) => <li key={row.id}>{row.type} · {row.points} · {row.reason}</li>)}
      </ul>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await takeLocale(params);
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(locale === "en" ? "/en/login" : "/prijava");
  const db = await requireDb();
  const mine = await db.select().from(orders).where(eq(orders.email, session.user.email));
  const sr = locale === "sr";
  return (
    <div className="wrap py-12">
      <h1 className="text-5xl">{session.user.name}</h1>
      <p className="mt-2 text-muted">{session.user.email}</p>
      <h2 className="mt-10 text-3xl">Moji bodovi</h2>
      <Points userId={session.user.id} />
      <h2 className="mt-10 text-3xl">{sr ? "Porudžbine" : "Orders"}</h2>
      {mine.length === 0 ? <p className="mt-4">{sr ? "Još nema porudžbina." : "No orders yet."}</p> : (
        <ul className="mt-4 divide-y divide-line">
          {mine.map((order) => (
            <li key={order.id} className="flex justify-between py-3">
              <a href={`${locale === "en" ? "/en/order/" : "/porudzbina/"}${order.number}`}>{order.number}</a>
              <span>{order.status} · {formatRsd(order.totalMinor, locale)} · {formatDate(order.createdAt, locale)}</span>
            </li>
          ))}
        </ul>
      )}
      <SignOut label={sr ? "Odjava" : "Sign out"} />
    </div>
  );
}
