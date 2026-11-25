"use server";

import { activeCampaign, addConfiguredBundle } from "@/server/features";
import { quoteBundle } from "@/lib/pricing";
import { canPurchase } from "@/lib/commerce";
import { requireDb } from "@/db";
import { productCategories, productVariants } from "@/db/schema";
import { inArray } from "drizzle-orm";

export async function previewBundleAction(selections: { variantId: string; quantity: number }[]) {
  const pack = await activeCampaign();
  if (!pack) return { ok: false as const };
  const db = await requireDb();
  const ids = selections.map((item) => item.variantId);
  const variants = ids.length ? await db.select().from(productVariants).where(inArray(productVariants.id, ids)) : [];
  const links = variants.length
    ? await db.select().from(productCategories).where(inArray(productCategories.productId, variants.map((item) => item.productId)))
    : [];
  const quote = quoteBundle({
    lines: selections.map((selection) => {
      const variant = variants.find((item) => item.id === selection.variantId);
      const categories = links.filter((link) => link.productId === variant?.productId).map((link) => link.categoryId);
      const eligible = !!variant && canPurchase(variant, selection.quantity) && (pack.targets.length === 0 || pack.targets.some((target) => target.productId === variant.productId || categories.includes(target.categoryId ?? "")));
      return { id: selection.variantId, unitMinor: variant?.priceMinor ?? 0, quantity: selection.quantity, eligible };
    }),
    rules: pack.rules.map((rule) => ({ kind: rule.kind === "fixed_amount" || rule.kind === "fixed_package" ? rule.kind : "percent" as const, minPairs: rule.minPairs, value: rule.value })),
    minPairs: pack.campaign.minPairs,
    maxPairs: pack.campaign.maxPairs,
    active: true,
    now: new Date(),
    startsAt: pack.campaign.startsAt,
    endsAt: pack.campaign.endsAt,
  });
  if (!quote.ok) return { ok: false as const };
  return quote;
}

export async function addBundleAction(selections: { variantId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const selection of selections) merged.set(selection.variantId, (merged.get(selection.variantId) ?? 0) + selection.quantity);
  return addConfiguredBundle([...merged.entries()].map(([variantId, quantity]) => ({ variantId, quantity })));
}
