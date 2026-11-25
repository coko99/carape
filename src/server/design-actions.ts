"use server";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { saveDesign } from "@/server/features";

export async function saveDesignAction(formData: FormData) {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  const file = formData.get("logo");
  let uploaded: { name: string; type: string; bytes: Uint8Array } | null = null;
  if (file instanceof File && file.size > 0) {
    uploaded = { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) };
  }
  return saveDesign({
    userId: session?.user.id ?? null,
    email: String(formData.get("email") || ""),
    contactName: String(formData.get("contact") || ""),
    phone: String(formData.get("phone") || ""),
    modelId: String(formData.get("modelId") || ""),
    baseColor: String(formData.get("base") || ""),
    accentColor: String(formData.get("accent") || ""),
    placement: "lisnica",
    logoX: Number(formData.get("x") || 50),
    logoY: Number(formData.get("y") || 40),
    logoScale: Number(formData.get("scale") || 30),
    quantity: Number(formData.get("quantity") || 0),
    sizeBreakdown: String(formData.get("sizes") || ""),
    packaging: String(formData.get("packaging") || ""),
    instructions: String(formData.get("instructions") || ""),
    file: uploaded,
    projectId: String(formData.get("projectId") || "") || null,
  });
}
