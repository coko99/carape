import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableStock,
  can,
  canPurchase,
  canTransition,
  discountMinor,
  formatRsd,
  netSalesMinor,
  orderTotal,
  quoteShipping,
} from "./commerce.ts";

describe("money and pricing", () => {
  it("formats RSD from minor units", () => {
    const formatted = formatRsd(55000, "sr");
    assert.match(formatted, /550/);
    assert.match(formatted, /RSD|дин/i);
  });

  it("applies percent and fixed coupons without going below zero", () => {
    assert.equal(discountMinor(10000, { type: "percent", value: 10 }), 1000);
    assert.equal(discountMinor(10000, { type: "fixed", value: 25000 }), 10000);
    assert.equal(discountMinor(5000, { type: "percent", value: 10, minGoodsMinor: 8000 }), 0);
  });

  it("keeps shipping unconfirmed until a price exists", () => {
    assert.deepEqual(
      quoteShipping({ goodsMinor: 12000, discountMinor: 0, flatMinor: null, freeThresholdMinor: null }),
      { priceMinor: null, status: "pending_price" },
    );
    assert.equal(
      quoteShipping({ goodsMinor: 12000, discountMinor: 0, flatMinor: 35000, freeThresholdMinor: 100000 }).priceMinor,
      35000,
    );
    assert.equal(
      quoteShipping({ goodsMinor: 120000, discountMinor: 0, flatMinor: 35000, freeThresholdMinor: 100000 }).status,
      "free",
    );
  });

  it("does not pretend a pending shipping amount is part of a known total", () => {
    const pending = orderTotal({ goodsMinor: 15000, discountMinor: 0, shippingMinor: null });
    assert.equal(pending.totalKnown, false);
    assert.equal(pending.totalMinor, 15000);
    const known = orderTotal({ goodsMinor: 15000, discountMinor: 1000, shippingMinor: 40000 });
    assert.equal(known.totalKnown, true);
    assert.equal(known.totalMinor, 54000);
  });
});

describe("stock", () => {
  it("allows purchase when the source did not publish a quantity but marked the item in stock", () => {
    const variant = { stockQuantity: null, reservedQuantity: 0, inStock: true };
    assert.equal(availableStock(variant), null);
    assert.equal(canPurchase(variant, 2), true);
  });

  it("blocks purchase when reserved stock would oversell", () => {
    const variant = { stockQuantity: 5, reservedQuantity: 4, inStock: true };
    assert.equal(canPurchase(variant, 2), false);
    assert.equal(canPurchase(variant, 1), true);
  });
});

describe("orders and access", () => {
  it("allows only the defined order transitions", () => {
    assert.equal(canTransition("placed", "confirmed"), true);
    assert.equal(canTransition("placed", "delivered"), false);
    assert.equal(canTransition("canceled", "confirmed"), false);
    assert.equal(canTransition("delivered", "refunded"), true);
  });

  it("enforces role permissions", () => {
    assert.equal(can("catalog_editor", "orders.update"), false);
    assert.equal(can("order_operator", "orders.update"), true);
    assert.equal(can("manager", "settings.write"), false);
    assert.equal(can("owner", "settings.write"), true);
    assert.equal(can("customer", "catalog"), false);
  });

  it("defines net sales as paid totals minus refunds", () => {
    assert.equal(netSalesMinor({ paidTotalMinor: 250000, refundedMinor: 15000 }), 235000);
  });
});
