export type StockSnapshot = {
  stockQuantity: number | null;
  reservedQuantity: number;
  damagedQuantity: number;
};

export function sellableAvailable(stock: StockSnapshot) {
  if (stock.stockQuantity == null) return null;
  return Math.max(0, stock.stockQuantity - stock.reservedQuantity);
}

export function adjustPhysical(stock: StockSnapshot, delta: number) {
  if (stock.stockQuantity == null) return { ok: false as const, reason: "uncounted" as const };
  const next = stock.stockQuantity + delta;
  if (next < 0) return { ok: false as const, reason: "negative" as const };
  if (next < stock.reservedQuantity) return { ok: false as const, reason: "below_reserved" as const };
  return { ok: true as const, stockQuantity: next, available: next - stock.reservedQuantity };
}

export function markDamaged(stock: StockSnapshot, quantity: number) {
  if (quantity < 1) return { ok: false as const, reason: "quantity" as const };
  const removed = adjustPhysical(stock, -quantity);
  if (!removed.ok) return removed;
  return { ok: true as const, stockQuantity: removed.stockQuantity, damagedQuantity: stock.damagedQuantity + quantity };
}

export function restockReturn(stock: StockSnapshot, quantity: number, restock: boolean) {
  if (quantity < 1) return { ok: false as const, reason: "quantity" as const };
  if (!restock) return { ok: true as const, stockQuantity: stock.stockQuantity, note: "not_restocked" as const };
  if (stock.stockQuantity == null) return { ok: false as const, reason: "uncounted" as const };
  return { ok: true as const, stockQuantity: stock.stockQuantity + quantity, note: "restocked" as const };
}

export function shouldReleaseReservation(input: {
  paymentStatus: string;
  orderStatus: string;
  ageHours: number;
  limitHours: number | null;
}) {
  if (input.limitHours == null) return false;
  if (input.paymentStatus !== "unpaid") return false;
  if (input.orderStatus === "canceled" || input.orderStatus === "refunded") return false;
  return input.ageHours >= input.limitHours;
}

export function reserveClaims(claims: { id: string; available: number | null; quantity: number }[]) {
  const need = new Map<string, { available: number | null; quantity: number }>();
  for (const claim of claims) {
    const current = need.get(claim.id) ?? { available: claim.available, quantity: 0 };
    current.quantity += claim.quantity;
    need.set(claim.id, current);
  }
  for (const row of need.values()) {
    if (row.available != null && row.available < row.quantity) return false;
  }
  return true;
}
