export type LoyaltyProgram = {
  enabled: boolean;
  minorPerPoint: number;
  pointsPerUnit: number;
  minorPerUnit: number;
  minRedeemPoints: number;
  maxSharePercent: number;
  activateOn: "paid" | "delivered";
  expiryDays: number | null;
  combineWithCoupons: boolean;
  combineWithBundles: boolean;
};

export const DISABLED_LOYALTY: LoyaltyProgram = {
  enabled: false,
  minorPerPoint: 0,
  pointsPerUnit: 1,
  minorPerUnit: 0,
  minRedeemPoints: 0,
  maxSharePercent: 100,
  activateOn: "paid",
  expiryDays: null,
  combineWithCoupons: false,
  combineWithBundles: false,
};

export function pointsEarned(spentMinor: number, minorPerPoint: number) {
  if (minorPerPoint < 1 || spentMinor < 1) return 0;
  return Math.floor(spentMinor / minorPerPoint);
}

export function quoteRedemption(input: {
  availablePoints: number;
  requestedPoints: number;
  pointsPerUnit: number;
  minorPerUnit: number;
  minPoints: number;
  maxSharePercent: number;
  goodsMinor: number;
  enabled: boolean;
}) {
  if (!input.enabled || input.requestedPoints <= 0) return { ok: true as const, points: 0, discountMinor: 0 };
  if (input.pointsPerUnit < 1 || input.minorPerUnit < 0 || input.goodsMinor < 0) {
    return { ok: false as const, reason: "invalid_rule" as const };
  }
  if (input.requestedPoints > input.availablePoints) return { ok: false as const, reason: "balance" as const };
  if (input.requestedPoints < input.minPoints) return { ok: false as const, reason: "minimum" as const };
  const cap = Math.round((input.goodsMinor * Math.min(100, Math.max(0, input.maxSharePercent))) / 100);
  const affordableUnits = input.minorPerUnit === 0 ? 0 : Math.floor(Math.min(input.goodsMinor, cap) / input.minorPerUnit);
  const requestedUnits = Math.floor(input.requestedPoints / input.pointsPerUnit);
  const units = Math.min(affordableUnits, requestedUnits);
  const points = units * input.pointsPerUnit;
  if (points < input.minPoints) return { ok: false as const, reason: "minimum" as const };
  return { ok: true as const, points, discountMinor: units * input.minorPerUnit };
}

export type LedgerEntry = {
  type: "pending" | "activated" | "redeemed" | "reversed" | "void_pending" | "expired" | "adjustment";
  points: number;
};

export function applyLedger(entries: LedgerEntry[]) {
  let pending = 0;
  let available = 0;
  for (const entry of entries) {
    if (entry.type === "pending") pending += entry.points;
    else if (entry.type === "activated") {
      if (entry.points > pending) return { ok: false as const, reason: "pending" as const };
      pending -= entry.points;
      available += entry.points;
    } else if (entry.type === "redeemed" || entry.type === "expired") {
      available -= entry.points;
    } else if (entry.type === "void_pending") {
      if (entry.points > pending) return { ok: false as const, reason: "pending" as const };
      pending -= entry.points;
    } else if (entry.type === "reversed" || entry.type === "adjustment") {
      available += entry.points;
    }
    if (pending < 0 || available < 0) return { ok: false as const, reason: "negative" as const };
  }
  return { ok: true as const, pending, available };
}

export function claimIdempotency(existing: Set<string>, key: string) {
  if (existing.has(key)) return { duplicate: true as const, keys: existing };
  const keys = new Set(existing);
  keys.add(key);
  return { duplicate: false as const, keys };
}

export function expiringPoints(input: { available: number; expiresAt: Date | null; now: Date; windowDays: number }) {
  if (!input.expiresAt || input.available <= 0) return 0;
  const horizon = input.now.getTime() + input.windowDays * 24 * 60 * 60 * 1000;
  return input.expiresAt.getTime() <= horizon ? input.available : 0;
}
