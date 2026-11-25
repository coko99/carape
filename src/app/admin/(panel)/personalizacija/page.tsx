import fs from "node:fs/promises";
import { requireStaff } from "@/server/admin";
import { designModels, saveDesignModel, transitionDesign } from "@/server/features";
import { requireDb } from "@/db";
import { designProjects } from "@/db/schema";
import { desc } from "drizzle-orm";
import { DESIGN_STATUSES, type DesignStatus } from "@/lib/quote-rules";

export default async function Page() {
  const { session } = await requireStaff("designs");
  const db = await requireDb();
  const projects = await db.select().from(designProjects).orderBy(desc(designProjects.createdAt));
  const models = await designModels();
  return (
    <div className="grid gap-6">
      <h1 className="text-4xl">Personalizovane porudžbine</h1>
      <form className="grid max-w-lg gap-2" action={async (formData) => {
        "use server";
        await requireStaff("designs");
        await saveDesignModel(String(formData.get("name") || ""), String(formData.get("colors") || "").split(","));
      }}>
        <h2 className="text-2xl">Odobreni model</h2>
        <input name="name" placeholder="Naziv modela" required />
        <input name="colors" placeholder="Boje, odvojene zarezom" required />
        <button className="btn w-fit" type="submit">Dodaj model</button>
      </form>
      <ul>{models.map((model) => <li key={model.id}>{model.name}: {model.colors.join(", ")}</li>)}</ul>
      {projects.map((project) => (
        <article key={project.id} className="border border-line p-4">
          <h2 className="text-2xl">{project.modelName}</h2>
          <p>{project.contactName} · {project.email} · {project.phone}</p>
          <p>Status: {project.status} · {project.quantity} pari · {project.sizeBreakdown}</p>
          <p>Boja {project.baseColor}{project.accentColor ? ` / ${project.accentColor}` : ""} · logo {project.logoX},{project.logoY} / {project.logoScale}</p>
          <p>Ilustracija nije potvrda izrade. {project.quoteMinor == null ? "Ponuda još nije uneta." : ""}</p>
          {project.logoPath ? <a href={`/admin/personalizacija/${project.id}/fajl`}>Preuzmi crtež</a> : null}
          <form className="mt-3 grid gap-2" action={async (formData) => {
            "use server";
            const staff = await requireStaff("designs");
            await transitionDesign(project.id, String(formData.get("status")) as DesignStatus, staff.session.user.id, String(formData.get("note") || ""));
          }}>
            <select name="status" defaultValue={project.status}>{DESIGN_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
            <textarea name="note" placeholder="Interna napomena" defaultValue={project.internalNote ?? ""} />
            <button className="btn w-fit" type="submit">Sačuvaj</button>
          </form>
        </article>
      ))}
      <p>{session.user.email}</p>
    </div>
  );
}

export async function readDesignFile(projectId: string) {
  const db = await requireDb();
  const { eq } = await import("drizzle-orm");
  const [project] = await db.select().from(designProjects).where(eq(designProjects.id, projectId));
  if (!project?.logoPath) return null;
  const bytes = await fs.readFile(project.logoPath);
  return { name: project.logoName ?? "logo", bytes };
}
