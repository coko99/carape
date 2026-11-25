type CouponType = "percent" | "fixed";

function couponDiscount(
  goodsMinor: number,
  coupon: { type: CouponType; value: number; minGoodsMinor?: number | null },
) {
  if (coupon.minGoodsMinor != null && goodsMinor < coupon.minGoodsMinor) return 0;
  if (coupon.type === "percent") {
    const percent = Math.min(100, Math.max(0, coupon.value));
    return Math.min(goodsMinor, Math.round((goodsMinor * percent) / 100));
  }
  return Math.min(goodsMinor, Math.max(0, coupon.value));
}

export type BundleKind = "percent" | "fixed_amount" | "fixed_package";

export type BundleRule = {
  kind: BundleKind;
  minPairs: number;
  value: number;
};

export type BundleLine = {
  id: string;
  unitMinor: number;
  quantity: number;
  eligible: boolean;
};

export type BundleQuote =
  | {
      ok: true;
      pairs: number;
      originalMinor: number;
      discountMinor: number;
      finalMinor: number;
      rule: BundleRule | null;
    }
  | { ok: false; reason: "below_minimum" | "above_maximum" | "empty" | "invalid_rule" };

export function quoteBundle(input: {
  lines: BundleLine[];
  rules: BundleRule[];
  minPairs: number;
  maxPairs: number | null;
  active?: boolean;
  now?: Date;
  startsAt?: Date | null;
  endsAt?: Date | null;
}): BundleQuote {
  if (input.active === false) return { ok: false, reason: "invalid_rule" };
  const now = input.now ?? new Date(0);
  if (input.startsAt && now < input.startsAt) return { ok: false, reason: "invalid_rule" };
  if (input.endsAt && now > input.endsAt) return { ok: false, reason: "invalid_rule" };
  if (input.minPairs < 1 || (input.maxPairs != null && input.maxPairs < input.minPairs)) {
    return { ok: false, reason: "invalid_rule" };
  }
  for (const line of input.lines) {
    if (line.quantity < 0 || line.unitMinor < 0) return { ok: false, reason: "invalid_rule" };
  }
  const eligible = input.lines.filter((line) => line.eligible && line.quantity > 0);
  const pairs = eligible.reduce((sum, line) => sum + line.quantity, 0);
  if (pairs < 1) return { ok: false, reason: "empty" };
  if (pairs < input.minPairs) return { ok: false, reason: "below_minimum" };
  if (input.maxPairs != null && pairs > input.maxPairs) return { ok: false, reason: "above_maximum" };
  const originalMinor = eligible.reduce((sum, line) => sum + line.unitMinor * line.quantity, 0);
  const rule =
    [...input.rules]
      .filter((item) => item.minPairs <= pairs && item.minPairs > 0 && item.value >= 0)
      .sort((a, b) => b.minPairs - a.minPairs)[0] ?? null;
  if (rule?.kind === "percent" && rule.value > 100) return { ok: false, reason: "invalid_rule" };
  let discount = 0;
  if (rule?.kind === "percent") discount = Math.round((originalMinor * rule.value) / 100);
  if (rule?.kind === "fixed_amount") discount = rule.value;
  if (rule?.kind === "fixed_package") discount = Math.max(0, originalMinor - rule.value);
  discount = Math.min(originalMinor, Math.max(0, discount));
  return { ok: true, pairs, originalMinor, discountMinor: discount, finalMinor: originalMinor - discount, rule };
}

export function bundleAfterReturn(input: {
  lines: BundleLine[];
  returned: { id: string; quantity: number }[];
  rules: BundleRule[];
  minPairs: number;
  maxPairs: number | null;
}) {
  const before = quoteBundle({ ...input, active: true });
  if (!before.ok) return { ok: false as const, reason: before.reason };
  const returned = new Map(input.returned.map((item) => [item.id, item.quantity]));
  const remaining = input.lines.map((line) => ({
    ...line,
    quantity: line.quantity - (returned.get(line.id) ?? 0),
  }));
  if (remaining.some((line) => line.quantity < 0)) return { ok: false as const, reason: "invalid_rule" as const };
  const pairsLeft = remaining.filter((line) => line.eligible).reduce((sum, line) => sum + line.quantity, 0);
  const after =
    pairsLeft === 0
      ? { ok: true as const, finalMinor: 0, discountMinor: 0, originalMinor: 0 }
      : quoteBundle({ lines: remaining, rules: input.rules, minPairs: 1, maxPairs: input.maxPairs, active: true });
  if (!after.ok) return { ok: false as const, reason: after.reason };
  const refundMinor = before.finalMinor - after.finalMinor;
  if (refundMinor < 0) return { ok: false as const, reason: "invalid_rule" as const };
  return {
    ok: true as const,
    refundMinor,
    remainingDiscountMinor: after.discountMinor,
    remainingFinalMinor: after.finalMinor,
  };
}

export function stackDiscounts(input: {
  goodsMinor: number;
  bundleDiscountMinor: number;
  coupon: { type: CouponType; value: number; minGoodsMinor?: number | null } | null;
  allowCouponWithBundle: boolean;
  loyaltyDiscountMinor: number;
  allowLoyaltyWithBundle: boolean;
  allowLoyaltyWithCoupon: boolean;
}) {
  if (input.goodsMinor < 0 || input.bundleDiscountMinor < 0 || input.loyaltyDiscountMinor < 0) {
    return { ok: false as const, reason: "negative" as const };
  }
  if (input.bundleDiscountMinor > input.goodsMinor) return { ok: false as const, reason: "negative" as const };
  if (input.bundleDiscountMinor > 0 && input.coupon && !input.allowCouponWithBundle) {
    return { ok: false as const, reason: "coupon_conflict" as const };
  }
  if (input.loyaltyDiscountMinor > 0 && input.bundleDiscountMinor > 0 && !input.allowLoyaltyWithBundle) {
    return { ok: false as const, reason: "loyalty_bundle" as const };
  }
  const afterBundle = input.goodsMinor - input.bundleDiscountMinor;
  const couponDiscountMinor = input.coupon ? couponDiscount(afterBundle, input.coupon) : 0;
  if (input.loyaltyDiscountMinor > 0 && couponDiscountMinor > 0 && !input.allowLoyaltyWithCoupon) {
    return { ok: false as const, reason: "loyalty_coupon" as const };
  }
  const room = afterBundle - couponDiscountMinor;
  const loyaltyDiscountMinor = Math.min(room, input.loyaltyDiscountMinor);
  const discountMinorTotal = input.bundleDiscountMinor + couponDiscountMinor + loyaltyDiscountMinor;
  if (discountMinorTotal > input.goodsMinor || room < 0) return { ok: false as const, reason: "negative" as const };
  return {
    ok: true as const,
    bundleDiscountMinor: input.bundleDiscountMinor,
    couponDiscountMinor,
    loyaltyDiscountMinor,
    discountMinor: discountMinorTotal,
    payableGoodsMinor: input.goodsMinor - discountMinorTotal,
  };
}

export function allocateDiscounts(
  lines: { id: string; amountMinor: number }[],
  discountMinor: number,
) {
  const base = lines.reduce((sum, line) => sum + Math.max(0, line.amountMinor), 0);
  if (discountMinor < 0 || discountMinor > base) return null;
  let left = discountMinor;
  return lines.map((line, index) => {
    const share =
      index === lines.length - 1 || base === 0
        ? left
        : Math.min(left, Math.round((discountMinor * Math.max(0, line.amountMinor)) / base));
    left -= share;
    return { id: line.id, allocatedDiscountMinor: share, netMinor: line.amountMinor - share };
  });
}

export function resolveUnitPrice(input: {
  retailMinor: number;
  quantity: number;
  approved: boolean;
  tiers: { minQuantity: number; priceMinor: number }[];
}) {
  if (!input.approved || input.quantity < 1) {
    return { unitMinor: input.retailMinor, wholesale: false as const };
  }
  const tier = input.tiers
    .filter((item) => item.minQuantity <= input.quantity && item.minQuantity > 0 && item.priceMinor >= 0)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0];
  if (!tier) return { unitMinor: input.retailMinor, wholesale: false as const };
  return { unitMinor: tier.priceMinor, wholesale: true as const };
}

export function meetsMinimumQuantity(quantity: number, tiers: { minQuantity: number }[], approved: boolean) {
  if (!approved || tiers.length === 0) return true;
  const floor = Math.min(...tiers.map((tier) => tier.minQuantity));
  return quantity >= floor;
}
