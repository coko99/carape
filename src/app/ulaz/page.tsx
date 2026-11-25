import { BrandMark } from "@/components/brand-mark";
import { safeNext } from "@/lib/site-gate";

export const instant = false;

export default async function UlazPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const query = await searchParams;
  const next = safeNext(query.next || "/");
  return (
    <main className="gate">
      <BrandMark className="h-20 w-auto" priority />
      <p className="kicker">Kruševac · 1992</p>
      <h1>Pregled sajta</h1>
      <p>Unesite lozinku da otvorite katalog.</p>
      <form action="/api/ulaz" method="post">
        <input type="hidden" name="next" value={next} />
        <label>
          Lozinka
          <input name="password" type="password" inputMode="numeric" autoComplete="current-password" required autoFocus />
        </label>
        <button className="btn" type="submit">Uđi</button>
      </form>
      {query.error ? <p className="gate-error">Pogrešna lozinka.</p> : null}
    </main>
  );
}
