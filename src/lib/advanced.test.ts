import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can } from "./commerce.ts";
import {
  allocateDiscounts,
  bundleAfterReturn,
  meetsMinimumQuantity,
  quoteBundle,
  resolveUnitPrice,
  stackDiscounts,
} from "./pricing.ts";
import { applyLedger, claimIdempotency, pointsEarned, quoteRedemption } from "./loyalty-math.ts";
import { adjustPhysical, markDamaged, reserveClaims, restockReturn, shouldReleaseReservation } from "./inventory-rules.ts";
import { financialSummary, periodBounds } from "./reports.ts";
import { allowChat, groundedAnswer, orderStatusFor, type AssistantKnowledge } from "./assistant-core.ts";
import { canConvertQuote, canTransitionDesign, canTransitionQuote, logoFileAllowed, quoteTotals } from "./quote-rules.ts";

const rules = [
  { kind: "percent" as const, minPairs: 3, value: 5 },
  { kind: "percent" as const, minPairs: 5, value: 10 },
  { kind: "percent" as const, minPairs: 10, value: 15 },
];

describe("bundles", () => {
  it("prices mixed sizes from the configured tier and keeps the final price non-negative", () => {
    const quote = quoteBundle({
      lines: [
        { id: "a", unitMinor: 14000, quantity: 2, eligible: true },
        { id: "b", unitMinor: 15000, quantity: 3, eligible: true },
      ],
      rules,
      minPairs: 3,
      maxPairs: 12,
      active: true,
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.pairs, 5);
    assert.equal(quote.originalMinor, 73000);
    assert.equal(quote.discountMinor, 7300);
    assert.equal(quote.finalMinor, 65700);
  });

  it("rejects a package outside the campaign and a fixed price above the goods", () => {
    assert.equal(quoteBundle({ lines: [{ id: "a", unitMinor: 100, quantity: 2, eligible: true }], rules, minPairs: 3, maxPairs: 10, active: true }).ok, false);
    const fixed = quoteBundle({
      lines: [{ id: "a", unitMinor: 1000, quantity: 3, eligible: true }],
      rules: [{ kind: "fixed_package", minPairs: 3, value: 5000 }],
      minPairs: 3,
      maxPairs: null,
      active: true,
    });
    assert.equal(fixed.ok && fixed.discountMinor, 0);
  });

  it("recalculates the discount when one pair from a bundle is returned", () => {
    const refund = bundleAfterReturn({
      lines: [
        { id: "a", unitMinor: 10000, quantity: 3, eligible: true },
        { id: "b", unitMinor: 10000, quantity: 2, eligible: true },
      ],
      returned: [{ id: "b", quantity: 2 }],
      rules,
      minPairs: 3,
      maxPairs: 10,
    });
    assert.equal(refund.ok, true);
    if (!refund.ok) return;
    assert.equal(refund.remainingFinalMinor, 28500);
    assert.equal(refund.refundMinor, 16500);
  });

  it("blocks a coupon when the campaign does not allow it", () => {
    const blocked = stackDiscounts({
      goodsMinor: 10000,
      bundleDiscountMinor: 1000,
      coupon: { type: "percent", value: 10 },
      allowCouponWithBundle: false,
      loyaltyDiscountMinor: 0,
      allowLoyaltyWithBundle: true,
      allowLoyaltyWithCoupon: true,
    });
    assert.equal(blocked.ok, false);
  });
});

describe("wholesale and loyalty", () => {
  it("hides wholesale tiers from a retail buyer and applies the quantity tier to an approved company", () => {
    const tiers = [
      { minQuantity: 100, priceMinor: 8000 },
      { minQuantity: 500, priceMinor: 7000 },
    ];
    assert.deepEqual(resolveUnitPrice({ retailMinor: 14000, quantity: 500, approved: false, tiers }), { unitMinor: 14000, wholesale: false });
    assert.deepEqual(resolveUnitPrice({ retailMinor: 14000, quantity: 500, approved: true, tiers }), { unitMinor: 7000, wholesale: true });
    assert.equal(meetsMinimumQuantity(50, tiers, true), false);
    assert.equal(meetsMinimumQuantity(100, tiers, true), true);
  });

  it("earns points only on the configured rate and refuses a second redemption of the same key", () => {
    assert.equal(pointsEarned(25000, 10000), 2);
    assert.equal(pointsEarned(9000, 10000), 0);
    const first = claimIdempotency(new Set(), "order-1-earn");
    const second = claimIdempotency(first.keys, "order-1-earn");
    assert.equal(second.duplicate, true);
  });

  it("redeems without a negative balance and reverses a canceled earn", () => {
    const redemption = quoteRedemption({
      availablePoints: 100,
      requestedPoints: 80,
      pointsPerUnit: 10,
      minorPerUnit: 1000,
      minPoints: 20,
      maxSharePercent: 50,
      goodsMinor: 10000,
      enabled: true,
    });
    assert.deepEqual(redemption, { ok: true, points: 50, discountMinor: 5000 });
    const ledger = applyLedger([
      { type: "pending", points: 10 },
      { type: "activated", points: 10 },
      { type: "redeemed", points: 4 },
      { type: "reversed", points: -6 },
    ]);
    assert.deepEqual(ledger, { ok: true, pending: 0, available: 0 });
    assert.equal(applyLedger([{ type: "redeemed", points: 1 }]).ok, false);
  });
});

describe("inventory and reports", () => {
  it("keeps one sellable counter and refuses an adjustment below reservations", () => {
    const stock = { stockQuantity: 10, reservedQuantity: 4, damagedQuantity: 0 };
    assert.equal(adjustPhysical(stock, -7).ok, false);
    const damaged = markDamaged(stock, 2);
    assert.equal(damaged.ok && damaged.stockQuantity, 8);
    assert.equal(damaged.ok && damaged.damagedQuantity, 2);
    assert.equal(reserveClaims([{ id: "v", available: 5, quantity: 2 }, { id: "v", available: 5, quantity: 2 }]), true);
    assert.equal(reserveClaims([{ id: "v", available: 5, quantity: 3 }, { id: "v", available: 5, quantity: 3 }]), false);
    assert.equal(shouldReleaseReservation({ paymentStatus: "unpaid", orderStatus: "placed", ageHours: 30, limitHours: 24 }), true);
    assert.equal(shouldReleaseReservation({ paymentStatus: "paid", orderStatus: "placed", ageHours: 30, limitHours: 24 }), false);
    assert.equal(restockReturn(stock, 1, false).ok && restockReturn(stock, 1, false).note, "not_restocked");
  });

  it("does not invent profit when a cost snapshot is missing", () => {
    const summary = financialSummary([
      {
        status: "confirmed",
        paymentStatus: "paid",
        channel: "retail",
        goodsMinor: 10000,
        discountMinor: 1000,
        bundleDiscountMinor: 1000,
        loyaltyDiscountMinor: 0,
        totalMinor: 9000,
        refundedMinor: 0,
        costMinor: 4000,
        createdAt: new Date("2026-11-01"),
      },
      {
        status: "placed",
        paymentStatus: "unpaid",
        channel: "wholesale",
        goodsMinor: 5000,
        discountMinor: 0,
        bundleDiscountMinor: 0,
        loyaltyDiscountMinor: 0,
        totalMinor: 5000,
        refundedMinor: 0,
        costMinor: null,
        createdAt: new Date("2026-11-02"),
      },
      {
        status: "canceled",
        paymentStatus: "unpaid",
        channel: "retail",
        goodsMinor: 3000,
        discountMinor: 0,
        bundleDiscountMinor: 0,
        loyaltyDiscountMinor: 0,
        totalMinor: 3000,
        refundedMinor: 0,
        costMinor: null,
        createdAt: new Date("2026-11-02"),
      },
    ]);
    assert.equal(summary.revenueMinor, 15000);
    assert.equal(summary.paidRevenueMinor, 9000);
    assert.equal(summary.pendingMinor, 5000);
    assert.equal(summary.canceledMinor, 3000);
    assert.equal(summary.netMinor, 9000);
    assert.equal(summary.cogsMinor, 4000);
    assert.equal(summary.estimatedGrossProfitMinor, 5000);
    assert.equal(summary.wholesaleMinor, 5000);
    const incomplete = financialSummary([
      {
        status: "confirmed",
        paymentStatus: "paid",
        channel: "retail",
        goodsMinor: 8000,
        discountMinor: 0,
        bundleDiscountMinor: 0,
        loyaltyDiscountMinor: 500,
        totalMinor: 8000,
        refundedMinor: 2000,
        costMinor: null,
        createdAt: new Date("2026-11-03"),
      },
    ]);
    assert.equal(incomplete.cogsMinor, null);
    assert.equal(incomplete.estimatedGrossProfitMinor, null);
    assert.equal(incomplete.netMinor, 6000);
    assert.equal(incomplete.loyaltyDiscountMinor, 500);
    const bounds = periodBounds(new Date("2026-11-01"), new Date("2026-11-11"));
    assert.equal(bounds.previousTo.toISOString(), new Date("2026-11-01").toISOString());
  });

  it("keeps cost and finance away from the catalog editor", () => {
    assert.equal(can("catalog_editor", "finance"), false);
    assert.equal(can("manager", "finance"), true);
    assert.equal(can("order_operator", "wholesale"), false);
    assert.equal(can("owner", "quotes"), true);
  });
});

describe("assistant, designs and quotations", () => {
  const knowledge: AssistantKnowledge = {
    chatEnabled: true,
    shippingMinor: null,
    paymentLabels: ["pouzećem", "uplatnicom"],
    faqs: [{ question: "Kako perete čarape?", answer: "Pratite oznaku na paru." }],
    products: [
      {
        name: "Muška termo čarapa",
        slug: "muska-termo",
        priceMinor: 25000,
        inStock: true,
        stockQuantity: null,
        sizes: ["43-46"],
        category: "muski",
      },
    ],
  };

  it("returns the catalog price and refuses a guessed order number", () => {
    const answer = groundedAnswer("Imate li muske termo carape?", knowledge);
    assert.equal(answer.cards[0]?.priceMinor, 25000);
    assert.match(answer.cards[0]?.availability ?? "", /nije objavljena/);
    assert.equal(groundedAnswer("Gde je porudzbina ZJ-2026-1001?", knowledge).text.includes("imejl"), true);
    assert.equal(orderStatusFor({ email: "a@b.rs", number: "ZJ-2026-1001", orders: [{ email: "other@b.rs", number: "ZJ-2026-1001", status: "placed" }] }).ok, false);
    assert.equal(orderStatusFor({ email: "a@b.rs", number: "ZJ-2026-1001", orders: [{ email: "a@b.rs", number: "ZJ-2026-1001", status: "confirmed" }] }).ok, true);
    assert.equal(allowChat(20, 20), false);
    assert.match(groundedAnswer("Koliko kosta dostava?", knowledge).text, /nije potvrđena/);
    assert.equal(groundedAnswer("nepoznat proizvod xyz", knowledge).unanswered, true);
  });

  it("checks artwork, quotation totals and conversion", () => {
    assert.equal(logoFileAllowed({ name: "logo.png", type: "image/png", size: 8, head: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]) }), true);
    assert.equal(logoFileAllowed({ name: "logo.svg", type: "image/svg+xml", size: 40, head: new TextEncoder().encode("<svg><script>") }), false);
    const totals = quoteTotals({
      lines: [{ quantity: 2, unitPriceMinor: 5000, discountMinor: 1000 }],
      shippingMinor: 400,
      taxMinor: null,
    });
    assert.equal(totals?.totalMinor, 9400);
    assert.equal(quoteTotals({ lines: [{ quantity: 1, unitPriceMinor: 100, discountMinor: 500 }], shippingMinor: 0, taxMinor: 0 }), null);
    assert.equal(canTransitionQuote("draft", "sent"), false);
    assert.equal(canTransitionQuote("pending_approval", "sent"), true);
    const now = new Date("2026-11-03");
    assert.equal(canConvertQuote({ status: "accepted", validUntil: new Date("2026-11-10"), now, orderId: null }), true);
    assert.equal(canConvertQuote({ status: "accepted", validUntil: new Date("2026-11-01"), now, orderId: null }), false);
    assert.equal(canConvertQuote({ status: "sent", validUntil: new Date("2026-11-10"), now, orderId: null }), false);
    assert.equal(canTransitionDesign("novi_upit", "u_proizvodnji"), false);
    assert.equal(canTransitionDesign("odobreno", "u_proizvodnji"), true);
  });

  it("allocates a discount across lines without losing a para", () => {
    const shares = allocateDiscounts(
      [
        { id: "a", amountMinor: 100 },
        { id: "b", amountMinor: 100 },
        { id: "c", amountMinor: 100 },
      ],
      100,
    );
    assert.equal(shares?.reduce((sum, line) => sum + line.allocatedDiscountMinor, 0), 100);
    assert.equal(shares?.every((line) => line.netMinor >= 0), true);
  });
});
