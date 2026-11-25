import { cookies, headers } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { requireDb } from "@/db";
import {
  bundleCampaigns,
  bundleRules,
  cartBundleItems,
  cartBundles,
  companies,
  couponRedemptions,
  coupons,
  inventoryMovements,
  loyaltyLedger,
  orderBundles,
  orderItems,
  orders,
  payments,
  priceListItems,
  priceLists,
  productVariants,
  products,
  shipments,
  siteSettings,
  stockReservations,
} from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { canPurchase, orderTotal, quoteShipping } from "@/lib/commerce";
import { allocateDiscounts, meetsMinimumQuantity, quoteBundle, resolveUnitPrice, stackDiscounts } from "@/lib/pricing";
import { applyLedger, pointsEarned, quoteRedemption } from "@/lib/loyalty-math";
import { loyaltyProgram } from "@/server/features";
import { checkoutSchema, type CheckoutInput } from "@/lib/validators";
import { sendTransactional } from "@/lib/email";
import { clearCart, CART_COOKIE, getCartLines, getCartToken } from "@/server/cart";
import { readSettings } from "@/server/seed";
import { carts } from "@/db/schema";

export async function placeOrder(input: CheckoutInput) {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" };

  const db = await requireDb();
  const lines = await getCartLines();
  if (lines.length === 0) {
    const { cartBundleViews } = await import("@/server/features");
    const bundles = await cartBundleViews();
    if (bundles.length === 0) return { ok: false as const, error: "empty" };
  }

  const recent = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.email, parsed.data.email), gt(orders.createdAt, new Date(Date.now() - 10 * 60 * 1000))));
  if (recent.length >= 5) return { ok: false as const, error: "rate" };

  const data = parsed.data;
  let buyerId: string | null = null;
  try {
    const session = await (await getAuth()).api.getSession({ headers: await headers() });
    buyerId = session?.user.id ?? null;
  } catch {
    buyerId = null;
  }
  const program = await loyaltyProgram();
  try {
    const created = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(orders).where(eq(orders.idempotencyKey, data.idempotencyKey));
      if (existing) return { order: existing, replayed: true as const };

      const settings = await readSettings(tx);
      let goodsMinor = 0;
      const priced: Array<{
        line: (typeof lines)[number];
        unitPriceMinor: number;
        stockState: string;
        costMinor: number | null;
        bundleId: string | null;
        color: string | null;
      }> = [];
      const [company] = buyerId ? await tx.select().from(companies).where(eq(companies.userId, buyerId)) : [];
      const approved = company?.status === "approved";
      const tiers = approved && company
        ? await tx
            .select({ variantId: priceListItems.variantId, minQuantity: priceListItems.minQuantity, priceMinor: priceListItems.priceMinor })
            .from(priceListItems)
            .innerJoin(priceLists, eq(priceListItems.priceListId, priceLists.id))
            .where(and(eq(priceLists.companyId, company.id), eq(priceLists.active, true)))
        : [];

      const reserveVariant = async (variantId: string, quantity: number, stockQuantity: number | null) => {
        if (stockQuantity == null) return "unverified_available";
        const reserved = await tx
          .update(productVariants)
          .set({ reservedQuantity: sql`${productVariants.reservedQuantity} + ${quantity}`, updatedAt: new Date() })
          .where(and(eq(productVariants.id, variantId), sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity} >= ${quantity}`))
          .returning();
        if (reserved.length === 0) throw new Error("STOCK");
        return "reserved";
      };

      for (const line of lines) {
        const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, line.variantId));
        const [product] = variant
          ? await tx.select().from(products).where(eq(products.id, variant.productId))
          : [];
        if (!variant || !product || product.status !== "published" || variant.status !== "published") {
          throw new Error("VARIANT");
        }
        if (!canPurchase(variant, line.quantity)) throw new Error("STOCK");
        const ownTiers = tiers.filter((tier) => tier.variantId === variant.id);
        if (!meetsMinimumQuantity(line.quantity, ownTiers, approved)) throw new Error("MINIMUM");
        const resolved = resolveUnitPrice({ retailMinor: variant.priceMinor, quantity: line.quantity, approved, tiers: ownTiers });
        const stockState = await reserveVariant(variant.id, line.quantity, variant.stockQuantity);
        goodsMinor += resolved.unitMinor * line.quantity;
        priced.push({
          line,
          unitPriceMinor: resolved.unitMinor,
          stockState,
          costMinor: variant.costMinor,
          bundleId: null,
          color: variant.color,
        });
      }

      const token = await getCartToken();
      const [cart] = token ? await tx.select().from(carts).where(eq(carts.token, token)) : [];
      let bundleDiscountMinor = 0;
      let allowCouponWithBundle = true;
      const pendingBundles: { id: string; campaignId: string; name: string; originalMinor: number; discountMinor: number; finalMinor: number }[] = [];
      if (cart) {
        const bundles = await tx.select().from(cartBundles).where(eq(cartBundles.cartId, cart.id));
        for (const bundle of bundles) {
          const [campaign] = await tx.select().from(bundleCampaigns).where(eq(bundleCampaigns.id, bundle.campaignId));
          const rules = await tx.select().from(bundleRules).where(eq(bundleRules.campaignId, bundle.campaignId));
          const items = await tx.select().from(cartBundleItems).where(eq(cartBundleItems.bundleId, bundle.id));
          const bundleLines = [];
          for (const item of items) {
            const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId));
            const [product] = variant ? await tx.select().from(products).where(eq(products.id, variant.productId)) : [];
            if (!variant || !product || !canPurchase(variant, item.quantity)) throw new Error("STOCK");
            const ownTiers = tiers.filter((tier) => tier.variantId === variant.id);
            const resolved = resolveUnitPrice({ retailMinor: variant.priceMinor, quantity: item.quantity, approved, tiers: ownTiers });
            const stockState = await reserveVariant(variant.id, item.quantity, variant.stockQuantity);
            bundleLines.push({ id: item.variantId, unitMinor: resolved.unitMinor, quantity: item.quantity, eligible: true });
            goodsMinor += resolved.unitMinor * item.quantity;
            priced.push({
              line: {
                itemId: item.id,
                quantity: item.quantity,
                variantId: variant.id,
                size: variant.size,
                sku: variant.sku,
                name: product.name,
                priceMinor: resolved.unitMinor,
                productId: product.id,
                slug: product.slug,
                regularPriceMinor: variant.regularPriceMinor,
                inStock: variant.inStock,
                stockQuantity: variant.stockQuantity,
                reservedQuantity: variant.reservedQuantity,
                stockState,
                status: product.status,
              },
              unitPriceMinor: resolved.unitMinor,
              stockState,
              costMinor: variant.costMinor,
              bundleId: bundle.id,
              color: variant.color,
            });
          }
          if (!campaign) throw new Error("BUNDLE");
          const quote = quoteBundle({
            lines: bundleLines,
            rules: rules.map((rule) => ({ kind: rule.kind === "fixed_amount" || rule.kind === "fixed_package" ? rule.kind : "percent", minPairs: rule.minPairs, value: rule.value })),
            minPairs: campaign.minPairs,
            maxPairs: campaign.maxPairs,
            active: campaign.active,
            now: new Date(),
            startsAt: campaign.startsAt,
            endsAt: campaign.endsAt,
          });
          if (!quote.ok) throw new Error("BUNDLE");
          bundleDiscountMinor += quote.discountMinor;
          allowCouponWithBundle = allowCouponWithBundle && campaign.combineWithCoupons;
          pendingBundles.push({
            id: bundle.id,
            campaignId: campaign.id,
            name: campaign.name,
            originalMinor: quote.originalMinor,
            discountMinor: quote.discountMinor,
            finalMinor: quote.finalMinor,
          });
        }
      }

      if (priced.length === 0) throw new Error("EMPTY");
      const minimum = company?.status === "approved" && company.minOrderMinor != null ? company.minOrderMinor : settings.minimumOrderMinor;
      if (minimum != null && goodsMinor < minimum) throw new Error("MINIMUM");

      let coupon: typeof coupons.$inferSelect | undefined;
      if (data.couponCode) {
        const [found] = await tx
          .select()
          .from(coupons)
          .where(eq(coupons.code, data.couponCode.trim().toUpperCase()));
        const now = new Date();
        if (
          !found ||
          !found.active ||
          (found.startsAt && found.startsAt > now) ||
          (found.endsAt && found.endsAt < now)
        ) {
          throw new Error("COUPON");
        }
        const consumed = await tx
          .update(coupons)
          .set({ usedCount: sql`${coupons.usedCount} + 1` })
          .where(
            and(
              eq(coupons.id, found.id),
              sql`${coupons.usageLimit} is null or ${coupons.usedCount} < ${coupons.usageLimit}`,
            ),
          )
          .returning();
        if (consumed.length === 0) throw new Error("COUPON");
        coupon = found;
      }

      const preliminary = stackDiscounts({
        goodsMinor,
        bundleDiscountMinor,
        coupon: coupon ? { type: coupon.type as "percent" | "fixed", value: coupon.value, minGoodsMinor: coupon.minGoodsMinor } : null,
        allowCouponWithBundle: bundleDiscountMinor === 0 || allowCouponWithBundle,
        loyaltyDiscountMinor: 0,
        allowLoyaltyWithBundle: program.combineWithBundles,
        allowLoyaltyWithCoupon: program.combineWithCoupons,
      });
      if (!preliminary.ok) throw new Error(preliminary.reason === "coupon_conflict" ? "COUPON" : "BUNDLE");
      const ledgerRows = buyerId ? await tx.select().from(loyaltyLedger).where(eq(loyaltyLedger.userId, buyerId)) : [];
      const balances = applyLedger(ledgerRows.map((row) => ({ type: row.type as "pending", points: row.points })));
      const requestedPoints = data.loyaltyPoints ?? 0;
      if (requestedPoints > 0 && (!buyerId || !program.enabled || !balances.ok)) throw new Error("LOYALTY");
      const redemption = quoteRedemption({
        availablePoints: balances.ok ? balances.available : 0,
        requestedPoints,
        pointsPerUnit: program.pointsPerUnit,
        minorPerUnit: program.minorPerUnit,
        minPoints: program.minRedeemPoints,
        maxSharePercent: program.maxSharePercent,
        goodsMinor: preliminary.payableGoodsMinor,
        enabled: program.enabled,
      });
      if (!redemption.ok) throw new Error("LOYALTY");
      const stacked = stackDiscounts({
        goodsMinor,
        bundleDiscountMinor,
        coupon: coupon ? { type: coupon.type as "percent" | "fixed", value: coupon.value, minGoodsMinor: coupon.minGoodsMinor } : null,
        allowCouponWithBundle: bundleDiscountMinor === 0 || allowCouponWithBundle,
        loyaltyDiscountMinor: redemption.discountMinor,
        allowLoyaltyWithBundle: program.combineWithBundles,
        allowLoyaltyWithCoupon: program.combineWithCoupons,
      });
      if (!stacked.ok) throw new Error("LOYALTY");
      const discount = stacked.discountMinor;
      const shipping = quoteShipping({
        goodsMinor,
        discountMinor: discount,
        flatMinor: settings.shippingFlatMinor,
        freeThresholdMinor: settings.freeDeliveryMinor,
      });
      const totals = orderTotal({
        goodsMinor,
        discountMinor: discount,
        shippingMinor: shipping.priceMinor,
      });

      const [sequence] = await tx
        .update(siteSettings)
        .set({
          value: sql`((${siteSettings.value})::int + 1)::text`,
          updatedAt: new Date(),
        })
        .where(eq(siteSettings.key, "order_seq"))
        .returning();
      const number = `ZJ-${new Date().getFullYear()}-${sequence?.value ?? "1001"}`;
      const orderId = crypto.randomUUID();
      const now = new Date();
      const [order] = await tx
        .insert(orders)
        .values({
          id: orderId,
          number,
          idempotencyKey: data.idempotencyKey,
          email: data.email,
          status: "placed",
          paymentMethod: data.paymentMethod,
          paymentStatus: "unpaid",
          goodsMinor,
          discountMinor: discount,
          shippingMinor: shipping.priceMinor,
          shippingStatus: shipping.status,
          taxMinor: null,
          taxNote: "PDV nije odvojeno objavljen na izvornom sajtu. Prikazana cena je maloprodajna cena iz kataloga.",
          totalKnown: totals.totalKnown,
          totalMinor: totals.totalMinor,
          couponCode: coupon?.code ?? null,
          userId: buyerId,
          channel: approved ? "wholesale" : "retail",
          companyId: approved ? company?.id ?? null : null,
          bundleDiscountMinor: stacked.bundleDiscountMinor,
          couponDiscountMinor: stacked.couponDiscountMinor,
          loyaltyDiscountMinor: stacked.loyaltyDiscountMinor,
          loyaltyPoints: redemption.points,
          customerName: data.name,
          phone: data.phone,
          line1: data.line1,
          line2: data.line2 || null,
          city: data.city,
          postalCode: data.postalCode,
          customerNote: data.note || null,
          locale: data.locale,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const shares = allocateDiscounts(
        priced.map((item, index) => ({ id: String(index), amountMinor: item.unitPriceMinor * item.line.quantity })),
        discount,
      );
      if (!shares) throw new Error("BUNDLE");
      await tx.insert(orderItems).values(
        priced.map((item, index) => ({
          id: crypto.randomUUID(),
          orderId,
          variantId: item.line.variantId,
          productName: item.line.name,
          sku: item.line.sku,
          size: item.line.size,
          color: item.color,
          quantity: item.line.quantity,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: item.unitPriceMinor * item.line.quantity,
          allocatedDiscountMinor: shares[index]?.allocatedDiscountMinor ?? 0,
          costMinor: item.costMinor,
          bundleId: item.bundleId,
          stockState: item.stockState,
        })),
      );
      if (pendingBundles.length) {
        await tx.insert(orderBundles).values(pendingBundles.map((bundle) => ({ ...bundle, orderId })));
      }
      const reservedRows = priced.filter((item) => item.stockState === "reserved");
      if (reservedRows.length) {
        await tx.insert(stockReservations).values(
          reservedRows.map((item) => ({
            id: crypto.randomUUID(),
            variantId: item.line.variantId,
            orderId,
            quantity: item.line.quantity,
            status: "active",
          })),
        );
      }
      if (buyerId && redemption.points > 0) {
        const next = applyLedger([
          ...ledgerRows.map((row) => ({ type: row.type as "pending", points: row.points })),
          { type: "redeemed" as const, points: redemption.points },
        ]);
        if (!next.ok) throw new Error("LOYALTY");
        await tx.insert(loyaltyLedger).values({
          id: crypto.randomUUID(),
          userId: buyerId,
          orderId,
          type: "redeemed",
          points: redemption.points,
          balanceAfter: next.available,
          pendingAfter: next.pending,
          idempotencyKey: `redeem:${data.idempotencyKey}`,
          reason: "Iskorišćeno na porudžbini",
        });
      }
      const earned = buyerId && program.enabled ? pointsEarned(stacked.payableGoodsMinor, program.minorPerPoint) : 0;
      if (buyerId && earned > 0) {
        const next = applyLedger([
          ...ledgerRows.map((row) => ({ type: row.type as "pending", points: row.points })),
          ...(redemption.points > 0 ? [{ type: "redeemed" as const, points: redemption.points }] : []),
          { type: "pending" as const, points: earned },
        ]);
        if (!next.ok) throw new Error("LOYALTY");
        await tx.insert(loyaltyLedger).values({
          id: crypto.randomUUID(),
          userId: buyerId,
          orderId,
          type: "pending",
          points: earned,
          balanceAfter: next.available,
          pendingAfter: next.pending,
          idempotencyKey: `earn:${data.idempotencyKey}`,
          reason: "Čeka aktivaciju posle plaćanja ili isporuke",
        });
      }
      await tx.insert(payments).values({
        id: crypto.randomUUID(),
        orderId,
        method: data.paymentMethod,
        status: "unpaid",
        amountMinor: totals.totalMinor,
        note: data.paymentMethod === "bank_transfer" && !settings.bankAccount
          ? "Broj računa nije unet. Instrukcija čeka podešavanje."
          : null,
      });
      await tx.insert(shipments).values({
        id: crypto.randomUUID(),
        orderId,
        method: "courier",
        status: shipping.status,
        priceMinor: shipping.priceMinor,
      });
      await tx.insert(inventoryMovements).values(
        priced.map((item) => ({
          id: crypto.randomUUID(),
          variantId: item.line.variantId,
          orderId,
          type: item.stockState === "reserved" ? "reserve" : "unverified_sale",
          quantityDelta: item.stockState === "reserved" ? item.line.quantity : 0,
          note: item.stockState === "reserved" ? null : "Količina nije bila objavljena na izvornom sajtu.",
        })),
      );
      if (coupon && discount > 0) {
        await tx.insert(couponRedemptions).values({
          id: crypto.randomUUID(),
          couponId: coupon.id,
          orderId,
          amountMinor: discount,
        });
      }
      return { order: order!, replayed: false as const };
    });

    if (created.replayed) return { ok: true as const, number: created.order.number };
    const placed = created.order;

    const token = await getCartToken();
    if (token) {
      const [cart] = await db.select().from(carts).where(eq(carts.token, token));
      if (cart) await clearCart(cart.id);
      const store = await cookies();
      store.delete(CART_COOKIE);
    }

    const shippingText =
      placed.shippingMinor == null
        ? "Dostava: cena nije potvrđena."
        : `Dostava: ${(placed.shippingMinor / 100).toFixed(2)} RSD`;
    const body = [
      `Porudžbina ${placed.number} je primljena.`,
      `Iznos proizvoda: ${(placed.goodsMinor / 100).toFixed(2)} RSD`,
      shippingText,
      placed.totalKnown
        ? `Ukupno: ${(placed.totalMinor / 100).toFixed(2)} RSD`
        : `Ukupno za proizvode: ${(placed.totalMinor / 100).toFixed(2)} RSD. Dostava će biti potvrđena.`,
      `Plaćanje: ${placed.paymentMethod === "cod" ? "pouzećem" : "uplatnicom"}.`,
      "Ovo nije fiskalni račun.",
    ].join("\n");
    await sendTransactional({
      to: placed.email,
      template: "order_placed",
      subject: `ŽA-JO porudžbina ${placed.number}`,
      body,
      relatedId: placed.id,
    });
    if (process.env.ORDERS_EMAIL) {
      await sendTransactional({
        to: process.env.ORDERS_EMAIL,
        template: "order_placed_admin",
        subject: `Nova porudžbina ${placed.number}`,
        body,
        relatedId: placed.id,
      });
    }
    revalidateTag("catalog", "max");
    return { ok: true as const, number: placed.number };
  } catch (error) {
    const code = error instanceof Error ? error.message : "failed";
    if (["VARIANT", "STOCK", "MINIMUM", "COUPON", "BUNDLE", "LOYALTY", "EMPTY"].includes(code)) {
      return { ok: false as const, error: code.toLowerCase() };
    }
    console.error(error);
    return { ok: false as const, error: "failed" };
  }
}
