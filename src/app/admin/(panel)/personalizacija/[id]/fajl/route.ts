import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { requireDb } from "@/db";
import { designProjects } from "@/db/schema";
import { requireStaff } from "@/server/admin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireStaff("designs");
  const { id } = await context.params;
  const db = await requireDb();
  const [project] = await db.select().from(designProjects).where(eq(designProjects.id, id));
  if (!project?.logoPath) return new Response("Nema fajla", { status: 404 });
  const bytes = await fs.readFile(project.logoPath);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${project.logoName ?? "logo"}"`,
    },
  });
}
