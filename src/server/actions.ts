"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidateTag } from "next/cache";
import { requireDb } from "@/db";
import { inquiries, newsletterConsents } from "@/db/schema";
import { contactSchema, newsletterSchema, wholesaleSchema } from "@/lib/validators";
import { addCartItem, updateCartItem } from "@/server/cart";
import { placeOrder } from "@/server/checkout";
import type { CheckoutInput } from "@/lib/validators";

export async function addToCartAction(variantId: string, quantity: number) {
  try {
    const result = await addCartItem(variantId, quantity);
    if (result.ok) revalidateTag("cart", "max");
    return result;
  } catch {
    return { ok: false as const, error: "database" };
  }
}

export async function updateCartAction(itemId: string, quantity: number) {
  const result = await updateCartItem(itemId, quantity);
  revalidateTag("cart", "max");
  return result;
}

export async function placeOrderAction(input: CheckoutInput) {
  return placeOrder(input);
}

export async function subscribeNewsletter(input: { email: string; consent: boolean; locale: "sr" | "en" }) {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const db = await requireDb();
  await db
    .insert(newsletterConsents)
    .values({
      id: crypto.randomUUID(),
      email: parsed.data.email.toLowerCase(),
      locale: parsed.data.locale,
      consented: true,
      source: "footer",
    })
    .onConflictDoUpdate({
      target: newsletterConsents.email,
      set: { consented: true, unsubscribedAt: null, locale: parsed.data.locale },
    });
  return { ok: true as const };
}

async function saveUpload(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 5_000_000) throw new Error("FILE");
  const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new Error("FILE");
  const bytes = Buffer.from(await file.arrayBuffer());
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 60);
  const filename = `${crypto.randomUUID()}-${safe || "file"}`;
  const directory = path.join(process.cwd(), "public", "media", "inquiries");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes);
  return `/media/inquiries/${filename}`;
}

export async function submitContact(formData: FormData) {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    message: formData.get("message"),
  });
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  const db = await requireDb();
  await db.insert(inquiries).values({
    id: crypto.randomUUID(),
    type: "contact",
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
  });
  return { ok: true as const };
}

export async function submitWholesale(formData: FormData) {
  const parsed = wholesaleSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    message: formData.get("message"),
    organization: formData.get("organization"),
    quantities: formData.get("quantities") || undefined,
    interests: formData.get("interests") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  try {
    const filePath = await saveUpload(formData.get("file"));
    const db = await requireDb();
    await db.insert(inquiries).values({
      id: crypto.randomUUID(),
      type: String(formData.get("type") || "wholesale"),
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      organization: parsed.data.organization,
      quantities: parsed.data.quantities,
      interests: parsed.data.interests,
      message: parsed.data.message,
      filePath,
    });
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "file" };
  }
}
