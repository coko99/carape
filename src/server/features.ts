import { headers } from "next/headers";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { requireDb } from "@/db";
import {
  bundleCampaigns,
  bundleRules,
  bundleTargets,
  cartBundleItems,
  cartBundles,
  categories,
  chatMessages,
  chatThreads,
  companies,
  designEvents,
  designProjects,
  inventoryMovements,
  loyaltyLedger,
  orderItems,
  orders,
  payments,
  priceListItems,
  priceLists,
  productCategories,
  productImages,
  productVariants,
  products,
  quotationEvents,
  quotationItems,
  quotations,
  shoppingListItems,
  shoppingLists,
  siteSettings,
  stockReservations,
  warehouses,
} from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { canPurchase } from "@/lib/commerce";
import { applyLedger, DISABLED_LOYALTY, pointsEarned, type LoyaltyProgram } from "@/lib/loyalty-math";
import { adjustPhysical, markDamaged, shouldReleaseReservation } from "@/lib/inventory-rules";
import { quoteBundle, type BundleRule } from "@/lib/pricing";
import { canConvertQuote, canTransitionDesign, canTransitionQuote, logoFileAllowed, quoteTotals, type DesignStatus, type QuoteStatus } from "@/lib/quote-rules";
import { financialSummary, periodBounds, type ReportOrder } from "@/lib/reports";
import { groundedAnswer, orderStatusFor, allowChat, type AssistantKnowledge } from "@/lib/assistant-core";
import { faqs } from "@/db/schema";
import { readSettings } from "@/server/seed";
import { carts } from "@/db/schema";
import { ensureCart, getCartToken } from "@/server/cart";

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const db = await requireDb();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
  if (!row) return fallback;
  const parsed = JSON.parse(row.value) as T;
  if (Array.isArray(fallback) || Array.isArray(parsed)) return parsed;
  return { ...(fallback as object), ...(parsed as object) } as T;
}

async function writeJson(key: string, value: unknown) {
  const db = await requireDb();
  await db
    .insert(siteSettings)
    .values({ key, value: JSON.stringify(value), updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: JSON.stringify(value), updatedAt: new Date() } });
}

export async function currentSession() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  return session;
}

export async function companyForUser(userId: string) {
  const db = await requireDb();
  const [company] = await db.select().from(companies).where(eq(companies.userId, userId));
  return company ?? null;
}

export async function loyaltyProgram() {
  return readJson<LoyaltyProgram>("loyalty", DISABLED_LOYALTY);
}

export async function saveLoyaltyProgram(program: LoyaltyProgram) {
  if (program.minorPerPoint < 0 || program.pointsPerUnit < 1 || program.minorPerUnit < 0 || program.maxSharePercent < 0 || program.maxSharePercent > 100) {
    return { ok: false as const };
  }
  await writeJson("loyalty", program);
  return { ok: true as const };
}

export async function loyaltyState(userId: string) {
  const db = await requireDb();
  const rows = await db.select().from(loyaltyLedger).where(eq(loyaltyLedger.userId, userId)).orderBy(asc(loyaltyLedger.createdAt));
  const balances = applyLedger(rows.map((row) => ({ type: row.type as "pending", points: row.points })));
  return { rows, balances };
}

export async function recordLoyalty(
  input: {
    userId: string;
    orderId?: string | null;
    type: "pending" | "activated" | "redeemed" | "reversed" | "void_pending" | "expired" | "adjustment";
    points: number;
    key: string;
    reason: string;
    actorId?: string | null;
  },
  db = requireDb(),
) {
  const database = await db;
  const existing = await database.select().from(loyaltyLedger).where(eq(loyaltyLedger.idempotencyKey, input.key));
  if (existing.length) return { ok: true as const, duplicate: true as const };
  const rows = await database.select().from(loyaltyLedger).where(eq(loyaltyLedger.userId, input.userId)).orderBy(asc(loyaltyLedger.createdAt));
  const next = applyLedger([
    ...rows.map((row) => ({ type: row.type as "pending", points: row.points })),
    { type: input.type, points: input.points },
  ]);
  if (!next.ok) return { ok: false as const, reason: next.reason };
  await database.insert(loyaltyLedger).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    orderId: input.orderId ?? null,
    type: input.type,
    points: input.points,
    balanceAfter: next.available,
    pendingAfter: next.pending,
    idempotencyKey: input.key,
    reason: input.reason,
    actorId: input.actorId ?? null,
  });
  return { ok: true as const, duplicate: false as const, balances: next };
}

export async function activeCampaign(now = new Date()) {
  const db = await requireDb();
  const campaigns = await db.select().from(bundleCampaigns).where(eq(bundleCampaigns.active, true));
  const campaign = campaigns.find((item) => (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt >= now));
  if (!campaign) return null;
  const rules = await db.select().from(bundleRules).where(eq(bundleRules.campaignId, campaign.id));
  const targets = await db.select().from(bundleTargets).where(eq(bundleTargets.campaignId, campaign.id));
  return { campaign, rules, targets };
}

export async function bundleCatalog() {
  const pack = await activeCampaign();
  const db = await requireDb();
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      slug: products.slug,
      variantId: productVariants.id,
      size: productVariants.size,
      color: productVariants.color,
      priceMinor: productVariants.priceMinor,
      inStock: productVariants.inStock,
      stockQuantity: productVariants.stockQuantity,
      reservedQuantity: productVariants.reservedQuantity,
      image: productImages.src,
      categoryId: productCategories.categoryId,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)))
    .leftJoin(productCategories, eq(productCategories.productId, products.id))
    .where(and(eq(products.status, "published"), eq(productVariants.status, "published")));
  const eligible = (productId: string, categoryId: string | null) => {
    if (!pack || pack.targets.length === 0) return true;
    return pack.targets.some((target) => target.productId === productId || (categoryId && target.categoryId === categoryId));
  };
  return { pack, rows: rows.filter((row) => eligible(row.productId, row.categoryId)) };
}

export async function addConfiguredBundle(selections: { variantId: string; quantity: number }[]) {
  const pack = await activeCampaign();
  if (!pack) return { ok: false as const, error: "campaign" };
  const db = await requireDb();
  const ids = selections.map((item) => item.variantId);
  const variants = ids.length ? await db.select().from(productVariants).where(inArray(productVariants.id, ids)) : [];
  const links = ids.length
    ? await db.select().from(productCategories).where(inArray(productCategories.productId, variants.map((item) => item.productId)))
    : [];
  const quote = quoteBundle({
    lines: selections.map((selection) => {
      const variant = variants.find((item) => item.id === selection.variantId);
      const categoriesForProduct = links.filter((link) => link.productId === variant?.productId).map((link) => link.categoryId);
      const eligible =
        !!variant &&
        variant.status === "published" &&
        canPurchase(variant, selection.quantity) &&
        (pack.targets.length === 0 ||
          pack.targets.some((target) => target.productId === variant.productId || categoriesForProduct.includes(target.categoryId ?? "")));
      return { id: selection.variantId, unitMinor: variant?.priceMinor ?? 0, quantity: selection.quantity, eligible };
    }),
    rules: pack.rules.map(asRule),
    minPairs: pack.campaign.minPairs,
    maxPairs: pack.campaign.maxPairs,
    active: true,
    now: new Date(),
    startsAt: pack.campaign.startsAt,
    endsAt: pack.campaign.endsAt,
  });
  if (!quote.ok) return { ok: false as const, error: quote.reason };
  if (selections.some((selection) => !variants.some((variant) => variant.id === selection.variantId && canPurchase(variant, selection.quantity)))) {
    return { ok: false as const, error: "stock" };
  }
  const cart = await ensureCart();
  const bundleId = crypto.randomUUID();
  await db.insert(cartBundles).values({ id: bundleId, cartId: cart.id, campaignId: pack.campaign.id });
  await db.insert(cartBundleItems).values(
    selections.filter((item) => item.quantity > 0).map((item) => ({
      id: crypto.randomUUID(),
      bundleId,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  );
  return { ok: true as const, quote };
}

function asRule(rule: { kind: string; minPairs: number; value: number }): BundleRule {
  const kind = rule.kind === "fixed_amount" || rule.kind === "fixed_package" ? rule.kind : "percent";
  return { kind, minPairs: rule.minPairs, value: rule.value };
}

export async function cartBundleViews() {
  const token = await getCartToken();
  if (!token) return [];
  const db = await requireDb();
  const [cart] = await db.select().from(carts).where(eq(carts.token, token));
  if (!cart) return [];
  const bundles = await db.select().from(cartBundles).where(eq(cartBundles.cartId, cart.id));
  const views = [];
  for (const bundle of bundles) {
    const [campaign] = await db.select().from(bundleCampaigns).where(eq(bundleCampaigns.id, bundle.campaignId));
    const rules = await db.select().from(bundleRules).where(eq(bundleRules.campaignId, bundle.campaignId));
    const items = await db
      .select({
        id: cartBundleItems.id,
        variantId: cartBundleItems.variantId,
        quantity: cartBundleItems.quantity,
        priceMinor: productVariants.priceMinor,
        size: productVariants.size,
        name: products.name,
        slug: products.slug,
        image: productImages.src,
      })
      .from(cartBundleItems)
      .innerJoin(productVariants, eq(cartBundleItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)))
      .where(eq(cartBundleItems.bundleId, bundle.id));
    const quote = campaign
      ? quoteBundle({
          lines: items.map((item) => ({ id: item.variantId, unitMinor: item.priceMinor, quantity: item.quantity, eligible: true })),
          rules: rules.map(asRule),
          minPairs: campaign.minPairs,
          maxPairs: campaign.maxPairs,
          active: campaign.active,
          now: new Date(),
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
        })
      : { ok: false as const, reason: "invalid_rule" as const };
    views.push({ bundleId: bundle.id, name: campaign?.name ?? "Paket", items, quote });
  }
  return views;
}

export async function saveBundleCampaign(input: {
  name: string;
  minPairs: number;
  maxPairs: number | null;
  combine: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  rules: BundleRule[];
  categoryIds: string[];
  productIds: string[];
}) {
  if (input.minPairs < 1 || input.rules.length === 0) return { ok: false as const };
  const db = await requireDb();
  const id = crypto.randomUUID();
  await db.insert(bundleCampaigns).values({
    id,
    name: input.name,
    minPairs: input.minPairs,
    maxPairs: input.maxPairs,
    combineWithCoupons: input.combine,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    active: input.active,
  });
  await db.insert(bundleRules).values(input.rules.map((rule) => ({ id: crypto.randomUUID(), campaignId: id, kind: rule.kind, minPairs: rule.minPairs, value: rule.value })));
  const targets = [
    ...input.categoryIds.filter(Boolean).map((categoryId) => ({ id: crypto.randomUUID(), campaignId: id, categoryId, productId: null })),
    ...input.productIds.filter(Boolean).map((productId) => ({ id: crypto.randomUUID(), campaignId: id, categoryId: null, productId })),
  ];
  if (targets.length) await db.insert(bundleTargets).values(targets);
  return { ok: true as const, id };
}

export async function bundleAdminData() {
  const db = await requireDb();
  const campaigns = await db.select().from(bundleCampaigns).orderBy(desc(bundleCampaigns.createdAt));
  const sold = await db.select().from((await import("@/db/schema")).orderBundles);
  return { campaigns, sold, categories: await db.select().from(categories).orderBy(asc(categories.nameSr)) };
}

export async function registerCompany(input: {
  userId: string;
  name: string;
  pib: string;
  registrationNumber: string;
  line1: string;
  city: string;
  postalCode: string;
  contactName: string;
  phone: string;
  email: string;
  website?: string;
}) {
  if (!/^\d{9}$/.test(input.pib) || !/^\d{8}$/.test(input.registrationNumber) || !/^\d{5}$/.test(input.postalCode)) {
    return { ok: false as const, error: "invalid" };
  }
  const db = await requireDb();
  const existing = await companyForUser(input.userId);
  if (existing) return { ok: false as const, error: "exists" };
  await db.insert(companies).values({ id: crypto.randomUUID(), status: "pending", website: input.website || null, ...input });
  return { ok: true as const };
}

export async function setCompanyStatus(id: string, status: "approved" | "rejected" | "suspended" | "pending", actorId: string) {
  const db = await requireDb();
  await db.update(companies).set({ status, updatedAt: new Date() }).where(eq(companies.id, id));
  const { auditLogs } = await import("@/db/schema");
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId, action: status, entity: "company", entityId: id });
  return { ok: true as const };
}

export async function savePriceTier(input: { companyId: string; variantId: string; minQuantity: number; priceMinor: number }) {
  if (input.minQuantity < 1 || input.priceMinor < 0) return { ok: false as const };
  const db = await requireDb();
  let [list] = await db.select().from(priceLists).where(eq(priceLists.companyId, input.companyId));
  if (!list) {
    list = { id: crypto.randomUUID(), companyId: input.companyId, name: "Veleprodaja", active: true, createdAt: new Date() };
    await db.insert(priceLists).values(list);
  }
  await db.insert(priceListItems).values({
    id: crypto.randomUUID(),
    priceListId: list.id,
    variantId: input.variantId,
    minQuantity: input.minQuantity,
    priceMinor: input.priceMinor,
  });
  return { ok: true as const };
}

export async function setCompanyTerms(id: string, paymentTermsDays: number | null, minOrderMinor: number | null) {
  const db = await requireDb();
  await db.update(companies).set({ paymentTermsDays, minOrderMinor, updatedAt: new Date() }).where(eq(companies.id, id));
  return { ok: true as const };
}

export async function wholesaleAdmin() {
  const db = await requireDb();
  const rows = await db.select().from(companies).orderBy(desc(companies.createdAt));
  const lists = await db.select().from(priceLists);
  const items = await db.select().from(priceListItems);
  const b2bOrders = await db.select().from(orders).where(eq(orders.channel, "wholesale"));
  return { rows, lists, items, b2bOrders };
}

export async function tiersForCompany(companyId: string) {
  const db = await requireDb();
  const lists = await db.select().from(priceLists).where(and(eq(priceLists.companyId, companyId), eq(priceLists.active, true)));
  if (!lists.length) return [];
  return db.select().from(priceListItems).where(inArray(priceListItems.priceListId, lists.map((list) => list.id)));
}

export async function repeatOrder(userEmail: string, orderId: string) {
  const db = await requireDb();
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.email, userEmail)));
  if (!order) return { ok: false as const };
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const { addCartItem } = await import("@/server/cart");
  for (const item of items) {
    if (item.variantId && !item.bundleId) await addCartItem(item.variantId, item.quantity);
  }
  return { ok: true as const };
}

export async function saveShoppingList(companyId: string, name: string, items: { variantId: string; quantity: number }[]) {
  const db = await requireDb();
  const id = crypto.randomUUID();
  await db.insert(shoppingLists).values({ id, companyId, name });
  if (items.length) {
    await db.insert(shoppingListItems).values(items.map((item) => ({ id: crypto.randomUUID(), listId: id, variantId: item.variantId, quantity: item.quantity })));
  }
  return { ok: true as const, id };
}

export async function inventoryTable(filters: { q?: string; size?: string; low?: boolean }) {
  const db = await requireDb();
  const rows = await db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      stockQuantity: productVariants.stockQuantity,
      reservedQuantity: productVariants.reservedQuantity,
      damagedQuantity: productVariants.damagedQuantity,
      lowStockThreshold: productVariants.lowStockThreshold,
      inStock: productVariants.inStock,
      costMinor: productVariants.costMinor,
      name: products.name,
      category: categories.nameSr,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(productCategories, eq(productCategories.productId, products.id))
    .leftJoin(categories, eq(productCategories.categoryId, categories.id));
  return rows.filter((row) => {
    if (filters.size && row.size !== filters.size) return false;
    if (filters.q && !`${row.name} ${row.sku ?? ""}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.low && !(row.stockQuantity != null && row.stockQuantity - row.reservedQuantity <= row.lowStockThreshold)) return false;
    return true;
  });
}

export async function adjustInventory(input: { variantId: string; delta: number; reason: string; actorId: string; warehouseId?: string | null; damaged?: boolean }) {
  if (!input.reason.trim()) return { ok: false as const, error: "reason" };
  const db = await requireDb();
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, input.variantId));
  if (!variant) return { ok: false as const, error: "missing" };
  const next = input.damaged
    ? markDamaged(variant, Math.abs(input.delta))
    : adjustPhysical(variant, input.delta);
  if (!next.ok) return { ok: false as const, error: next.reason };
  await db
    .update(productVariants)
    .set({
      stockQuantity: next.stockQuantity,
      damagedQuantity: "damagedQuantity" in next ? next.damagedQuantity : variant.damagedQuantity,
      stockState: "counted",
      inStock: next.stockQuantity > 0,
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, variant.id));
  await db.insert(inventoryMovements).values({
    id: crypto.randomUUID(),
    variantId: variant.id,
    actorId: input.actorId,
    type: input.damaged ? "damaged" : "adjustment",
    quantityDelta: input.damaged ? -Math.abs(input.delta) : input.delta,
    stockAfter: next.stockQuantity,
    reason: input.reason.trim(),
    warehouseId: input.warehouseId || null,
  });
  return { ok: true as const };
}

export async function setVariantCost(variantId: string, costMinor: number | null) {
  if (costMinor != null && costMinor < 0) return { ok: false as const };
  const db = await requireDb();
  await db.update(productVariants).set({ costMinor, updatedAt: new Date() }).where(eq(productVariants.id, variantId));
  return { ok: true as const };
}

export async function inventoryAnalytics() {
  const db = await requireDb();
  const items = await db.select().from(orderItems);
  const variants = await db.select().from(productVariants);
  const sold = new Map<string, number>();
  const sizes = new Map<string, number>();
  const colors = new Map<string, number>();
  for (const item of items) {
    sold.set(item.productName, (sold.get(item.productName) ?? 0) + item.quantity);
    sizes.set(item.size, (sizes.get(item.size) ?? 0) + item.quantity);
    if (item.color) colors.set(item.color, (colors.get(item.color) ?? 0) + item.quantity);
  }
  const ranked = [...sold.entries()].sort((a, b) => b[1] - a[1]);
  const valued = variants.filter((variant) => variant.stockQuantity != null && variant.costMinor != null);
  const unvalued = variants.filter((variant) => variant.stockQuantity != null && variant.costMinor == null).length;
  return {
    fast: ranked.slice(0, 8),
    slow: ranked.length ? ranked.slice(-8).reverse() : [],
    sizes: [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    colors: [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    replenish: variants.filter((variant) => variant.stockQuantity != null && variant.stockQuantity - variant.reservedQuantity <= variant.lowStockThreshold),
    stockValueMinor: valued.reduce((sum, variant) => sum + (variant.stockQuantity ?? 0) * (variant.costMinor ?? 0), 0),
    unvalued,
    movements: await db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt)).limit(40),
    warehouses: await db.select().from(warehouses),
  };
}

export async function addWarehouse(name: string) {
  if (name.trim().length < 2) return { ok: false as const };
  const db = await requireDb();
  await db.insert(warehouses).values({ id: crypto.randomUUID(), name: name.trim() });
  return { ok: true as const };
}

export async function releaseExpiredReservations() {
  const hours = await readJson<{ hours: number | null }>("reservation_hours", { hours: null });
  if (hours.hours == null) return { released: 0 };
  const db = await requireDb();
  const active = await db.select().from(stockReservations).where(eq(stockReservations.status, "active"));
  let released = 0;
  for (const reservation of active) {
    if (!reservation.orderId) continue;
    const [order] = await db.select().from(orders).where(eq(orders.id, reservation.orderId));
    if (!order) continue;
    const ageHours = (Date.now() - order.createdAt.getTime()) / 36e5;
    if (!shouldReleaseReservation({ paymentStatus: order.paymentStatus, orderStatus: order.status, ageHours, limitHours: hours.hours })) continue;
    await db.update(stockReservations).set({ status: "released" }).where(eq(stockReservations.id, reservation.id));
    await db
      .update(productVariants)
      .set({ reservedQuantity: sql`greatest(${productVariants.reservedQuantity} - ${reservation.quantity}, 0)` })
      .where(eq(productVariants.id, reservation.variantId));
    released += 1;
  }
  return { released };
}

export type DesignModel = { id: string; name: string; colors: string[] };

export async function designModels() {
  return readJson<DesignModel[]>("design_models", []);
}

export async function saveDesignModel(name: string, colors: string[]) {
  const models = await designModels();
  const next = [...models, { id: crypto.randomUUID(), name: name.trim(), colors: colors.map((color) => color.trim()).filter(Boolean) }];
  await writeJson("design_models", next);
}

export async function saveDesign(input: {
  userId: string | null;
  email: string;
  contactName: string;
  phone: string;
  modelId: string;
  baseColor: string;
  accentColor: string;
  placement: string;
  logoX: number;
  logoY: number;
  logoScale: number;
  quantity: number;
  sizeBreakdown: string;
  packaging: string;
  instructions: string;
  file?: { name: string; type: string; bytes: Uint8Array } | null;
  projectId?: string | null;
}) {
  const models = await designModels();
  const model = models.find((item) => item.id === input.modelId);
  if (!model || !model.colors.includes(input.baseColor) || input.quantity < 1) return { ok: false as const, error: "model" };
  let logoPath: string | null = null;
  let logoName: string | null = null;
  if (input.file) {
    const head = input.file.bytes.slice(0, 512);
    if (!logoFileAllowed({ name: input.file.name, type: input.file.type, size: input.file.bytes.byteLength, head })) {
      return { ok: false as const, error: "file" };
    }
    const id = crypto.randomUUID();
    const safe = path.basename(input.file.name).replace(/[^a-zA-Z0-9._-]/g, "");
    logoPath = path.join("storage", "designs", id, safe);
    await fs.mkdir(path.dirname(logoPath), { recursive: true });
    await fs.writeFile(logoPath, input.file.bytes);
    logoName = safe;
  }
  const db = await requireDb();
  if (input.projectId) {
    const [existing] = await db.select().from(designProjects).where(eq(designProjects.id, input.projectId));
    if (!existing || (existing.userId && existing.userId !== input.userId) || existing.email !== input.email) return { ok: false as const, error: "owner" };
    if (existing.status !== "novi_upit" && existing.status !== "u_pripremi_ponude") return { ok: false as const, error: "status" };
    await db.update(designProjects).set({
      baseColor: input.baseColor,
      accentColor: input.accentColor || null,
      placement: input.placement,
      logoX: input.logoX,
      logoY: input.logoY,
      logoScale: input.logoScale,
      quantity: input.quantity,
      sizeBreakdown: input.sizeBreakdown,
      packaging: input.packaging || null,
      instructions: input.instructions || null,
      logoPath: logoPath ?? existing.logoPath,
      logoName: logoName ?? existing.logoName,
      updatedAt: new Date(),
    }).where(eq(designProjects.id, existing.id));
    return { ok: true as const, id: existing.id };
  }
  const id = crypto.randomUUID();
  await db.insert(designProjects).values({
    id,
    userId: input.userId,
    email: input.email,
    contactName: input.contactName,
    phone: input.phone,
    modelId: model.id,
    modelName: model.name,
    baseColor: input.baseColor,
    accentColor: input.accentColor || null,
    placement: input.placement,
    logoX: input.logoX,
    logoY: input.logoY,
    logoScale: input.logoScale,
    quantity: input.quantity,
    sizeBreakdown: input.sizeBreakdown,
    packaging: input.packaging || null,
    instructions: input.instructions || null,
    logoPath,
    logoName,
    status: "novi_upit",
  });
  await db.insert(designEvents).values({ id: crypto.randomUUID(), projectId: id, status: "novi_upit", note: "Upit je sačuvan. Prikaz je ilustracija." });
  return { ok: true as const, id };
}

export async function transitionDesign(id: string, status: DesignStatus, actorId: string, note: string) {
  const db = await requireDb();
  const [project] = await db.select().from(designProjects).where(eq(designProjects.id, id));
  if (!project || !canTransitionDesign(project.status as DesignStatus, status)) return { ok: false as const };
  await db.update(designProjects).set({ status, internalNote: note || project.internalNote, updatedAt: new Date() }).where(eq(designProjects.id, id));
  await db.insert(designEvents).values({ id: crypto.randomUUID(), projectId: id, status, note, actorId });
  return { ok: true as const };
}

export async function quoteLinesTotal(lines: { quantity: number; unitPriceMinor: number; discountMinor: number }[], shippingMinor: number | null, taxMinor: number | null) {
  return quoteTotals({ lines, shippingMinor, taxMinor });
}

export async function createQuotation(input: {
  actorId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPib?: string;
  buyerAddress?: string;
  companyId?: string | null;
  designId?: string | null;
  validUntil: Date;
  shippingMinor: number | null;
  taxMinor: number | null;
  paymentTerms: string;
  deliveryNote: string;
  notes: string;
  lines: { variantId?: string | null; description: string; sku?: string | null; quantity: number; unitPriceMinor: number; discountMinor: number }[];
}) {
  const totals = quoteTotals({
    lines: input.lines,
    shippingMinor: input.shippingMinor,
    taxMinor: input.taxMinor,
  });
  if (!totals || input.lines.length === 0) return { ok: false as const };
  const db = await requireDb();
  const [sequence] = await db
    .update(siteSettings)
    .set({ value: sql`((${siteSettings.value})::int + 1)::text`, updatedAt: new Date() })
    .where(eq(siteSettings.key, "quote_seq"))
    .returning();
  const id = crypto.randomUUID();
  const number = `PON-${new Date().getFullYear()}-${sequence?.value ?? "1001"}`;
  await db.insert(quotations).values({
    id,
    number,
    token: crypto.randomUUID(),
    companyId: input.companyId || null,
    designId: input.designId || null,
    status: "draft",
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    buyerPib: input.buyerPib || null,
    buyerAddress: input.buyerAddress || null,
    goodsMinor: totals.goodsMinor,
    discountMinor: totals.discountMinor,
    shippingMinor: totals.shippingMinor,
    taxMinor: totals.taxMinor,
    taxNote: totals.taxMinor == null ? "Porez nije unet." : null,
    totalMinor: totals.totalMinor,
    paymentTerms: input.paymentTerms || null,
    deliveryNote: input.deliveryNote || null,
    notes: input.notes || null,
    validUntil: input.validUntil,
    createdBy: input.actorId,
  });
  await db.insert(quotationItems).values(
    input.lines.map((line) => ({
      id: crypto.randomUUID(),
      quotationId: id,
      variantId: line.variantId || null,
      description: line.description,
      sku: line.sku || null,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      discountMinor: line.discountMinor,
      lineTotalMinor: line.unitPriceMinor * line.quantity - line.discountMinor,
    })),
  );
  await db.insert(quotationEvents).values({ id: crypto.randomUUID(), quotationId: id, status: "draft", actorId: input.actorId });
  return { ok: true as const, id, number };
}

export async function transitionQuote(id: string, status: QuoteStatus, actorId: string) {
  const db = await requireDb();
  const [quote] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!quote || !canTransitionQuote(quote.status as QuoteStatus, status)) return { ok: false as const };
  const snapshot = status === "sent" ? JSON.stringify(quote) : quote.sentSnapshot;
  await db.update(quotations).set({ status, sentSnapshot: snapshot, updatedAt: new Date() }).where(eq(quotations.id, id));
  await db.insert(quotationEvents).values({ id: crypto.randomUUID(), quotationId: id, status, actorId });
  return { ok: true as const };
}

export async function openQuoteToken(token: string) {
  const db = await requireDb();
  const [quote] = await db.select().from(quotations).where(eq(quotations.token, token));
  if (!quote) return null;
  if (quote.status === "sent") {
    await db.update(quotations).set({ status: "viewed", updatedAt: new Date() }).where(eq(quotations.id, quote.id));
    await db.insert(quotationEvents).values({ id: crypto.randomUUID(), quotationId: quote.id, status: "viewed", note: "Kupac je otvorio link." });
    quote.status = "viewed";
  }
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, quote.id));
  return { quote, items };
}

export async function acceptQuoteToken(token: string) {
  const opened = await openQuoteToken(token);
  if (!opened) return { ok: false as const };
  const now = new Date();
  if (opened.quote.validUntil < now) {
    await (await requireDb()).update(quotations).set({ status: "expired", updatedAt: now }).where(eq(quotations.id, opened.quote.id));
    return { ok: false as const, error: "expired" };
  }
  if (opened.quote.status !== "viewed" && opened.quote.status !== "sent") return { ok: false as const, error: "status" };
  const db = await requireDb();
  await db.update(quotations).set({ status: "accepted", updatedAt: now }).where(eq(quotations.id, opened.quote.id));
  await db.insert(quotationEvents).values({ id: crypto.randomUUID(), quotationId: opened.quote.id, status: "accepted" });
  return { ok: true as const };
}

export async function convertQuote(id: string, actorId: string) {
  const db = await requireDb();
  const [quote] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!quote || !canConvertQuote({ status: quote.status as QuoteStatus, validUntil: quote.validUntil, now: new Date(), orderId: quote.orderId })) {
    return { ok: false as const, error: "status" };
  }
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
  const orderId = crypto.randomUUID();
  const [sequence] = await db
    .update(siteSettings)
    .set({ value: sql`((${siteSettings.value})::int + 1)::text`, updatedAt: new Date() })
    .where(eq(siteSettings.key, "order_seq"))
    .returning();
  const number = `ZJ-${new Date().getFullYear()}-${sequence?.value ?? "1001"}`;
  try {
    await db.transaction(async (tx) => {
      for (const item of items) {
        if (!item.variantId) continue;
        const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId));
        if (!variant || !canPurchase(variant, item.quantity)) throw new Error("STOCK");
        if (variant.stockQuantity != null) {
          const reserved = await tx
            .update(productVariants)
            .set({ reservedQuantity: sql`${productVariants.reservedQuantity} + ${item.quantity}` })
            .where(and(eq(productVariants.id, variant.id), sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity} >= ${item.quantity}`))
            .returning();
          if (!reserved.length) throw new Error("STOCK");
        }
      }
      await tx.insert(orders).values({
        id: orderId,
        number,
        idempotencyKey: `quote-${quote.id}`,
        email: quote.buyerEmail,
        status: "placed",
        paymentMethod: "bank_transfer",
        paymentStatus: "unpaid",
        goodsMinor: quote.goodsMinor,
        discountMinor: quote.discountMinor,
        shippingMinor: quote.shippingMinor,
        shippingStatus: quote.shippingMinor == null ? "pending_price" : "priced",
        taxMinor: quote.taxMinor,
        taxNote: "Ponuda nije fiskalni račun.",
        totalKnown: quote.shippingMinor != null,
        totalMinor: quote.totalMinor,
        channel: quote.companyId ? "wholesale" : "retail",
        companyId: quote.companyId,
        customerName: quote.buyerName,
        phone: "-",
        line1: quote.buyerAddress || "Adresa iz ponude",
        city: "-",
        postalCode: "00000",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await tx.insert(orderItems).values(
        items.map((item) => ({
          id: crypto.randomUUID(),
          orderId,
          variantId: item.variantId,
          productName: item.description,
          sku: item.sku,
          size: "-",
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: item.lineTotalMinor,
          allocatedDiscountMinor: item.discountMinor,
          stockState: "reserved",
        })),
      );
      await tx.insert(payments).values({
        id: crypto.randomUUID(),
        orderId,
        method: "bank_transfer",
        status: "unpaid",
        amountMinor: quote.totalMinor,
        note: "Nastalo iz ponude. Nije fiskalni račun.",
      });
      await tx.update(quotations).set({ orderId, updatedAt: new Date() }).where(eq(quotations.id, quote.id));
    });
  } catch {
    return { ok: false as const, error: "stock" };
  }
  const { auditLogs } = await import("@/db/schema");
  await db.insert(auditLogs).values({ id: crypto.randomUUID(), actorId, action: "convert", entity: "quotation", entityId: id });
  return { ok: true as const, number };
}

export async function financeData(from: Date, to: Date) {
  const db = await requireDb();
  const rows = await db.select().from(orders).where(and(gte(orders.createdAt, from), lte(orders.createdAt, to)));
  const paymentRows = await db.select().from(payments);
  const itemRows = await db.select().from(orderItems);
  const reportOrders: ReportOrder[] = rows.map((order) => {
    const payment = paymentRows.find((item) => item.orderId === order.id);
    const ownItems = itemRows.filter((item) => item.orderId === order.id);
    const costs = ownItems.every((item) => item.costMinor != null)
      ? ownItems.reduce((sum, item) => sum + (item.costMinor ?? 0) * item.quantity, 0)
      : null;
    return {
      status: order.status,
      paymentStatus: order.paymentStatus,
      channel: order.channel === "wholesale" ? "wholesale" : "retail",
      goodsMinor: order.goodsMinor,
      discountMinor: order.discountMinor,
      bundleDiscountMinor: order.bundleDiscountMinor,
      loyaltyDiscountMinor: order.loyaltyDiscountMinor,
      totalMinor: order.totalMinor,
      refundedMinor: payment?.refundedMinor ?? 0,
      costMinor: costs,
      createdAt: order.createdAt,
    };
  });
  const bounds = periodBounds(from, to);
  const previousRows = await db.select().from(orders).where(and(gte(orders.createdAt, bounds.previousFrom), lte(orders.createdAt, bounds.previousTo)));
  return { summary: financialSummary(reportOrders), orders: rows, previousCount: previousRows.length, previousGoods: previousRows.reduce((sum, order) => sum + order.goodsMinor, 0) };
}

export async function assistantReply(input: { token: string; question: string; email?: string; orderNumber?: string }) {
  const settings = await readJson<{ enabled: boolean; welcome: string; dailyLimit: number }>("assistant", {
    enabled: true,
    welcome: "Mogu da pomognem oko kataloga, dostave i plaćanja. Cene čitam iz prodavnice.",
    dailyLimit: 30,
  });
  const db = await requireDb();
  let [thread] = await db.select().from(chatThreads).where(eq(chatThreads.token, input.token));
  if (!thread) {
    thread = { id: crypto.randomUUID(), token: input.token, userId: null, createdAt: new Date() };
    await db.insert(chatThreads).values(thread);
  }
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.select().from(chatMessages).where(eq(chatMessages.threadId, thread.id));
  const count = recent.filter((message) => message.createdAt >= since && message.role === "user").length;
  if (!allowChat(count, settings.dailyLimit)) return { ok: false as const, error: "limit" };
  await db.insert(chatMessages).values({ id: crypto.randomUUID(), threadId: thread.id, role: "user", body: input.question });
  const catalog = await db
    .select({
      name: products.name,
      slug: products.slug,
      priceMinor: productVariants.priceMinor,
      inStock: productVariants.inStock,
      stockQuantity: productVariants.stockQuantity,
      reservedQuantity: productVariants.reservedQuantity,
      size: productVariants.size,
      category: categories.nameSr,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(productCategories, eq(productCategories.productId, products.id))
    .leftJoin(categories, eq(productCategories.categoryId, categories.id))
    .where(eq(products.status, "published"));
  const grouped = new Map<string, AssistantKnowledge["products"][number]>();
  for (const row of catalog) {
    const current = grouped.get(row.slug) ?? {
      name: row.name,
      slug: row.slug,
      priceMinor: row.priceMinor,
      inStock: row.inStock,
      stockQuantity: row.stockQuantity == null ? null : Math.max(0, row.stockQuantity - row.reservedQuantity),
      sizes: [],
      category: row.category ?? "",
    };
    if (!current.sizes.includes(row.size)) current.sizes.push(row.size);
    grouped.set(row.slug, current);
  }
  const store = await readSettings(db);
  const publishedFaqs = await db.select().from(faqs).where(eq(faqs.published, true));
  let text = "";
  let cards: { name: string; slug: string; priceMinor: number; availability: string }[] = [];
  if (input.orderNumber && input.email) {
    const found = orderStatusFor({
      email: input.email,
      number: input.orderNumber,
      orders: (await db.select().from(orders)).map((order) => ({ email: order.email, number: order.number, status: order.status })),
    });
    text = found.ok ? `Porudžbina ${found.number} ima status ${found.status}.` : "Porudžbina i imejl se ne poklapaju.";
  } else {
    const answer = groundedAnswer(input.question, {
      products: [...grouped.values()],
      faqs: publishedFaqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
      shippingMinor: store.shippingFlatMinor,
      paymentLabels: ["pouzećem", "uplatnicom"],
      chatEnabled: settings.enabled,
    });
    text = answer.text;
    cards = answer.cards;
    if (answer.unanswered) {
      const { auditLogs } = await import("@/db/schema");
      await db.insert(auditLogs).values({ id: crypto.randomUUID(), action: "unanswered", entity: "assistant", metadata: input.question });
    }
    if (process.env.AI_GATEWAY_API_KEY && process.env.AI_MODEL) {
      try {
        const response = await fetch(process.env.AI_BASE_URL || "https://ai-gateway.vercel.sh/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.AI_MODEL,
            messages: [
              { role: "system", content: "Odgovaraj na srpskom latinicom. Ne navodi cenu, stanje ni rok koji nije u kontekstu. Kontekst: " + text },
              { role: "user", content: input.question },
            ],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
          const phrased = payload.choices?.[0]?.message?.content;
          if (phrased) text = phrased;
        }
      } catch {
        text = `${text} (AI servis nije dostupan, prikazani su podaci iz kataloga.)`;
      }
    }
  }
  await db.insert(chatMessages).values({ id: crypto.randomUUID(), threadId: thread.id, role: "assistant", body: text });
  return { ok: true as const, text, cards, welcome: settings.welcome, ai: Boolean(process.env.AI_GATEWAY_API_KEY && process.env.AI_MODEL) };
}

export async function assistantAdmin() {
  const db = await requireDb();
  const messages = await db.select().from(chatMessages);
  const { auditLogs } = await import("@/db/schema");
  const unanswered = await db.select().from(auditLogs).where(eq(auditLogs.action, "unanswered"));
  const settings = await readJson("assistant", { enabled: true, welcome: "Mogu da pomognem oko kataloga, dostave i plaćanja. Cene čitam iz prodavnice.", dailyLimit: 30 });
  return { settings, messages: messages.length, unanswered: unanswered.length };
}

export async function saveAssistant(settings: { enabled: boolean; welcome: string; dailyLimit: number }) {
  await writeJson("assistant", settings);
}

export async function markOrderPaid(orderId: string, actorId: string) {
  const db = await requireDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order || order.paymentStatus === "paid") return { ok: false as const };
  await db.update(orders).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(orders.id, orderId));
  await db.update(payments).set({ status: "paid", updatedAt: new Date() }).where(eq(payments.orderId, orderId));
  const program = await loyaltyProgram();
  if (program.enabled && program.activateOn === "paid" && order.userId) {
    const pending = await db.select().from(loyaltyLedger).where(and(eq(loyaltyLedger.orderId, order.id), eq(loyaltyLedger.type, "pending")));
    if (pending[0]) {
      await recordLoyalty({ userId: order.userId, orderId: order.id, type: "activated", points: pending[0].points, key: `activate:${order.id}`, reason: "Plaćanje je evidentirano.", actorId });
    }
  }
  return { ok: true as const };
}

export { pointsEarned };
