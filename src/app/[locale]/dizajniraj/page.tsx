import { headers } from "next/headers";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { takeLocale } from "@/i18n/locale";
import { requireDb } from "@/db";
import { designProjects } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { designModels } from "@/server/features";
import { DesignStudio } from "@/components/design-studio";

async function Body({ params }: { params: Promise<{ locale: string }> }) {
  await takeLocale(params);
  const models = await designModels();
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  const mine = session ? await (await requireDb()).select().from(designProjects).where(eq(designProjects.email, session.user.email)) : [];
  return (
    <div className="wrap py-10">
      <h1 className="text-5xl">Dizajniraj svoje čarape</h1>
      <p className="mt-3 max-w-2xl">Za firme, klubove i promotivne serije. Prikaz je ilustracija. Pošaljite upit za ponudu.</p>
      {models.length === 0 ? <p className="mt-8">Proizvođač još nije uneo modele koji se mogu personalizovati.</p> : <div className="mt-8"><DesignStudio models={models} email={session?.user.email ?? ""} /></div>}
      {mine.length ? (
        <div className="mt-10">
          <h2 className="text-3xl">Sačuvani projekti</h2>
          <ul className="mt-3">{mine.map((project) => <li key={project.id}>{project.modelName} · {project.status} · {project.quantity} pari</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  return <Suspense fallback={<div className="wrap py-16">…</div>}><Body params={params} /></Suspense>;
}
