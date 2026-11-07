import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALERT_THRESHOLDS,
  DEFAULT_SUPPLIER_PRICING,
  isSignificantChange,
  proposeSellPrice,
  tryProposeSellPrice,
} from "../lib/supplier-pricing";
import { checkChangeApproval, checkInitialPricing, decidePriceAlert } from "../lib/supplier-price-decisions";

const S = DEFAULT_SUPPLIER_PRICING;
const T = DEFAULT_ALERT_THRESHOLDS;

describe("pricing input validation", () => {
  it.each([0, -1, NaN, Infinity])("rejects supplier cost %s", (usd) => {
    expect(() => proposeSellPrice(usd, S)).toThrow();
    expect(tryProposeSellPrice(usd, S)).toBeNull();
  });
  it.each([0, -5, NaN])("rejects exchange rate %s", (rate) => {
    expect(() => proposeSellPrice(10, { ...S, usd_inr_rate: rate })).toThrow();
  });
  it("$38.89 Steam card becomes ₹4,970, never ₹38.89", () => {
    expect(proposeSellPrice(38.89, S).proposedSellPriceInr).toBe(4970);
  });
});

describe("alert thresholds", () => {
  it("ignores a 1-cent move on a $10 package (0.1%)", () => {
    expect(isSignificantChange(10, 10.01, T)).toBe(false);
  });
  it("flags a 5% increase and a 5% decrease", () => {
    expect(isSignificantChange(10, 10.5, T)).toBe(true);
    expect(isSignificantChange(10, 9.5, T)).toBe(true);
  });
});

describe("decidePriceAlert", () => {
  const priced = { id: "s1", customer_price_inr: 1280, priced_at_supplier_usd: 10 };
  it("never alerts on unpriced packages", () => {
    expect(decidePriceAlert({ id: "s", customer_price_inr: null, priced_at_supplier_usd: null }, 20, S, T).kind).toBe("none");
  });
  it("supersedes pending alerts on tiny moves", () => {
    expect(decidePriceAlert(priced, 10.02, S, T).kind).toBe("supersede");
  });
  it("compares against the approved baseline so small moves accumulate", () => {
    const d = decidePriceAlert(priced, 10.2, S, T);
    expect(d.kind).toBe("alert");
    if (d.kind === "alert") {
      expect(d.changePct).toBe(2);
      expect(d.previousCustomerPriceInr).toBe(1280);
      expect(d.proposal.proposedSellPriceInr).toBe(proposeSellPrice(10.2, S).proposedSellPriceInr);
    }
  });
});

describe("approval guards", () => {
  const change = { status: "pending", kind: "change", previous_customer_price_inr: 1280, new_supplier_price_usd: 10.5 };
  const svc = { active: true, customer_price_inr: 1280, supplier_price: 10.5 };
  it("approves a live, unchanged package", () => expect(checkChangeApproval(change, svc).ok).toBe(true));
  it("refuses legacy alerts", () => expect(checkChangeApproval({ ...change, kind: "legacy" }, svc).ok).toBe(false));
  it("refuses when the customer price moved", () => expect(checkChangeApproval(change, { ...svc, customer_price_inr: 1300 }).ok).toBe(false));
  it("refuses when the supplier cost moved again", () => expect(checkChangeApproval(change, { ...svc, supplier_price: 11 }).ok).toBe(false));
  it("refuses inactive packages", () => expect(checkChangeApproval(change, { ...svc, active: false }).ok).toBe(false));
  it("initial pricing needs a positive USD cost and no existing price", () => {
    expect(checkInitialPricing({ active: true, customer_price_inr: null, supplier_price: 5, currency: "USD" }).ok).toBe(true);
    expect(checkInitialPricing({ active: true, customer_price_inr: 640, supplier_price: 5, currency: "USD" }).ok).toBe(false);
    expect(checkInitialPricing({ active: true, customer_price_inr: null, supplier_price: 0, currency: "USD" }).ok).toBe(false);
    expect(checkInitialPricing({ active: true, customer_price_inr: null, supplier_price: 5, currency: "EUR" }).ok).toBe(false);
  });
});
