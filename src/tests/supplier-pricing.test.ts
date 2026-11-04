import { describe, expect, it } from "vitest";
import { DEFAULT_SUPPLIER_PRICING, hasSupplierPriceChanged, proposeSellPrice } from "../lib/supplier-pricing";

describe("supplier price proposals (₹111.1111/USD, 15%, round up ₹10)", () => {
  it.each([
    [1.8, 230],
    [5, 640],
    [10, 1280],
    [90, 11500],
  ])("$%s → ₹%s", (usd, inr) => {
    expect(proposeSellPrice(usd, DEFAULT_SUPPLIER_PRICING).proposedSellPriceInr).toBe(inr);
  });

  it("rounds up to ₹5 when configured", () => {
    expect(proposeSellPrice(1, { ...DEFAULT_SUPPLIER_PRICING, rounding_step: 5 }).proposedSellPriceInr).toBe(130);
  });

  it("never proposes below acquisition cost", () => {
    const p = proposeSellPrice(1.8, { ...DEFAULT_SUPPLIER_PRICING, markup_pct: 0 });
    expect(p.proposedSellPriceInr).toBeGreaterThanOrEqual(p.acquisitionCostInr);
    expect(p.acquisitionCostInr).toBe(200);
  });

  it("detects real changes only", () => {
    expect(hasSupplierPriceChanged(1.8, 1.9)).toBe(true);
    expect(hasSupplierPriceChanged(1.8, 1.8)).toBe(false);
    expect(hasSupplierPriceChanged(null, 1.8)).toBe(false);
  });
});
