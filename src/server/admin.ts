import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { orderItems, orders, payments, productVariants, products, shipments } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { can, canTransition, isStaff, netSalesMinor, type OrderStatus } from "@/lib/commerce";
import { sendTransactional } from "@/lib/email";

export async function requireStaff(permission: string) {
  await connection();
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !isStaff(role) || !can(role, permission)) redirect("/admin/prijava");
  return { session, role: role! };
}

export async function dashboardData() {
  await connection();
  const db = await requireDb();
  const rows = await db.select().from(orders);
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const active = rows.filter((order) => order.status !== "canceled");
  const paid = active.filter((order) => order.paymentStatus === "paid" || order.paymentStatus === "refunded");
  const paidTotal = paid.reduce((sum, order) => sum + order.totalMinor, 0);
  const refunds = rows.reduce((sum, order) => sum + (order.paymentStatus === "refunded" ? order.totalMinor : 0), 0);
  const inRange = (date: Date, from: Date) => date >= from;
  return {
    today: rows.filter((order) => inRange(order.createdAt, startOfDay)).length,
    week: rows.filter((order) => inRange(order.createdAt, week)).length,
    month: rows.filter((order) => inRange(order.createdAt, month)).length,
    gross: active.reduce((sum, order) => sum + order.goodsMinor, 0),
    refunds,
    net: netSalesMinor({ paidTotalMinor: paidTotal, refundedMinor: refunds }),
    average: active.length ? Math.round(active.reduce((sum, order) => sum + order.totalMinor, 0) / active.length) : 0,
    recent: rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8),
    unverifiedStock: await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(eq(productVariants.stockState, "not_published")),
  };
}

export async function listOrders() {
  const db = await requireDb();
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrder(id: string) {
  const db = await requireDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const [payment] = await db.select().from(payments).where(eq(payments.orderId, id));
  const [shipment] = await db.select().from(shipments).where(eq(shipments.orderId, id));
  return { order, items, payment, shipment };
}

export async function transitionOrder(input: {
  orderId: string;
  status: OrderStatus;
  tracking?: string;
  actorId?: string;
}) {
  await requireStaff("orders.update");
  const db = await requireDb();
  const current = await getOrder(input.orderId);
  if (!current) return { ok: false as const };
  if (!canTransition(current.order.status as OrderStatus, input.status)) return { ok: false as const, error: "transition" };
  await db.update(orders).set({ status: input.status, updatedAt: new Date() }).where(eq(orders.id, input.orderId));
  if (input.tracking) {
    await db.update(shipments).set({ trackingNumber: input.tracking, status: input.status, shippedAt: input.status === "shipped" ? new Date() : undefined }).where(eq(shipments.orderId, input.orderId));
  }
  if (input.status === "canceled") {
    const { stockReservations, loyaltyLedger } = await import("@/db/schema");
    const { applyLedger } = await import("@/lib/loyalty-math");
    for (const item of current.items) {
      if (item.stockState === "reserved" && item.variantId) {
        await db
          .update(productVariants)
          .set({ reservedQuantity: sql`greatest(${productVariants.reservedQuantity} - ${item.quantity}, 0)` })
          .where(eq(productVariants.id, item.variantId));
      }
    }
    await db.update(stockReservations).set({ status: "released" }).where(eq(stockReservations.orderId, input.orderId));
    if (current.order.userId) {
      const rows = await db.select().from(loyaltyLedger).where(eq(loyaltyLedger.userId, current.order.userId));
      const pending = rows.find((row) => row.orderId === current.order.id && row.type === "pending");
      if (pending) {
        const next = applyLedger([...rows.map((row) => ({ type: row.type as "pending", points: row.points })), { type: "void_pending", points: pending.points }]);
        if (next.ok) {
          await db.insert(loyaltyLedger).values({
            id: crypto.randomUUID(),
            userId: current.order.userId,
            orderId: current.order.id,
            type: "void_pending",
            points: pending.points,
            balanceAfter: next.available,
            pendingAfter: next.pending,
            idempotencyKey: `void:${current.order.id}`,
            reason: "Porudžbina je otkazana",
            actorId: input.actorId,
          });
        }
      }
    }
  }
  await sendTransactional({
    to: current.order.email,
    template: `order_${input.status}`,
    subject: `ŽA-JO ${current.order.number}: ${input.status}`,
    body: `Status porudžbine ${current.order.number} je sada ${input.status}.${input.tracking ? ` Praćenje: ${input.tracking}` : ""}`,
    relatedId: current.order.id,
  });
  return { ok: true as const };
}

export async function listProductsAdmin() {
  const db = await requireDb();
  return db.select().from(products).orderBy(products.name);
}

export async function updateVariantStock(variantId: string, stockQuantity: number) {
  await requireStaff("inventory");
  const db = await requireDb();
  await db
    .update(productVariants)
    .set({ stockQuantity, stockState: "counted", inStock: stockQuantity > 0, updatedAt: new Date() })
    .where(and(eq(productVariants.id, variantId), sql`${stockQuantity} >= 0`));
}
