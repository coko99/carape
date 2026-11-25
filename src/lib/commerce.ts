export const CURRENCY = "RSD";

export function formatRsd(minor: number, locale: "sr" | "en" = "sr") {
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const whole = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, locale === "sr" ? "." : ",");
  const decimal = locale === "sr" ? "," : ".";
  const amount = `${negative ? "−" : ""}${grouped}${decimal}${fraction}`;
  return locale === "sr" ? `${amount} RSD` : `RSD ${amount}`;
}

export function formatDate(date: Date, locale: "sr" | "en" = "sr") {
  return new Intl.DateTimeFormat(locale === "sr" ? "sr-RS" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Belgrade",
  }).format(date);
}

export type CouponType = "percent" | "fixed";

export function discountMinor(
  goodsMinor: number,
  coupon: { type: CouponType; value: number; minGoodsMinor?: number | null } | null,
) {
  if (!coupon) return 0;
  if (coupon.minGoodsMinor != null && goodsMinor < coupon.minGoodsMinor) return 0;
  if (coupon.type === "percent") {
    const percent = Math.min(100, Math.max(0, coupon.value));
    return Math.min(goodsMinor, Math.round((goodsMinor * percent) / 100));
  }
  return Math.min(goodsMinor, Math.max(0, coupon.value));
}

export type ShippingQuote = {
  priceMinor: number | null;
  status: "priced" | "free" | "pending_price";
};

export function quoteShipping(input: {
  goodsMinor: number;
  discountMinor: number;
  flatMinor: number | null;
  freeThresholdMinor: number | null;
}) {
  const net = Math.max(0, input.goodsMinor - input.discountMinor);
  if (input.freeThresholdMinor != null && net >= input.freeThresholdMinor) {
    return { priceMinor: 0, status: "free" } satisfies ShippingQuote;
  }
  if (input.flatMinor == null) return { priceMinor: null, status: "pending_price" } satisfies ShippingQuote;
  return { priceMinor: input.flatMinor, status: "priced" } satisfies ShippingQuote;
}

export function orderTotal(input: {
  goodsMinor: number;
  discountMinor: number;
  shippingMinor: number | null;
}) {
  const known = input.shippingMinor != null;
  const totalMinor = input.goodsMinor - input.discountMinor + (input.shippingMinor ?? 0);
  return { totalMinor, totalKnown: known };
}

export function availableStock(variant: {
  stockQuantity: number | null;
  reservedQuantity: number;
  inStock: boolean;
}) {
  if (!variant.inStock) return 0;
  if (variant.stockQuantity == null) return null;
  return Math.max(0, variant.stockQuantity - variant.reservedQuantity);
}

export function canPurchase(
  variant: { stockQuantity: number | null; reservedQuantity: number; inStock: boolean },
  quantity: number,
) {
  if (quantity < 1) return false;
  const available = availableStock(variant);
  if (available == null) return variant.inStock;
  return available >= quantity;
}

export const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "shipped",
  "delivered",
  "canceled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "canceled"],
  confirmed: ["shipped", "canceled", "refunded"],
  shipped: ["delivered", "canceled", "refunded"],
  delivered: ["refunded"],
  canceled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

export type Role = "owner" | "manager" | "order_operator" | "catalog_editor" | "customer";

const PERMISSIONS: Record<Role, string[]> = {
  owner: ["*"],
  manager: [
    "dashboard",
    "orders",
    "customers",
    "catalog",
    "marketing",
    "content",
    "reports",
    "inventory",
    "settings.read",
    "finance",
    "wholesale",
    "quotes",
    "loyalty",
    "designs",
    "assistant",
  ],
  order_operator: ["dashboard", "orders", "customers.read", "inventory.read"],
  catalog_editor: ["dashboard", "catalog", "content", "inventory", "designs"],
  customer: [],
};

export function can(role: string | null | undefined, permission: string) {
  const list = PERMISSIONS[(role as Role) || "customer"] ?? [];
  if (list.includes("*") || list.includes(permission)) return true;
  const head = permission.split(".")[0];
  return list.includes(head);
}

export function isStaff(role: string | null | undefined) {
  return role === "owner" || role === "manager" || role === "order_operator" || role === "catalog_editor";
}

/**
 * Net sales = paid merchandise and known shipping, minus recorded refunds.
 * Canceled and unpaid orders are excluded. Pending shipping is excluded
 * because that amount was never confirmed.
 */
export function netSalesMinor(input: {
  paidTotalMinor: number;
  refundedMinor: number;
}) {
  return input.paidTotalMinor - input.refundedMinor;
}
