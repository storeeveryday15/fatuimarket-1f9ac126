/**
 * Supplier price proposal maths (pure). Used by catalog sync, the admin price
 * monitor preview and approval so every path calculates identically.
 * Never applied to customers automatically.
 */

export type SupplierPricingSettings = {
  usd_inr_rate: number;
  markup_pct: number;
  rounding_step: 1 | 5 | 10;
};

export type AlertThresholds = { min_change_pct: number; min_change_usd: number };

export const DEFAULT_SUPPLIER_PRICING: SupplierPricingSettings = {
  usd_inr_rate: 111.1111,
  markup_pct: 15,
  rounding_step: 10,
};

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = { min_change_pct: 1, min_change_usd: 0.01 };

export type PriceProposal = {
  acquisitionCostInr: number;
  proposedSellPriceInr: number;
  expectedProfitInr: number;
  expectedMarginPct: number;
};

export class PricingError extends Error {}

/** Throws when settings would produce a meaningless price. */
export function validatePricingSettings(s: SupplierPricingSettings): void {
  if (!Number.isFinite(s.usd_inr_rate) || s.usd_inr_rate <= 0 || s.usd_inr_rate > 1000)
    throw new PricingError("Invalid USD/INR rate");
  if (!Number.isFinite(s.markup_pct) || s.markup_pct < 0 || s.markup_pct > 500)
    throw new PricingError("Invalid markup");
  if (![1, 5, 10].includes(Number(s.rounding_step))) throw new PricingError("Invalid rounding step");
}

/** Round UP to the step; tiny epsilon absorbs float noise (229.99997 → 230). */
export function roundUpToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value / step - 1e-6) * step;
}

/** Supplier USD × rate × (1 + markup), rounded UP. Throws on invalid input. */
export function proposeSellPrice(usd: number, s: SupplierPricingSettings): PriceProposal {
  validatePricingSettings(s);
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) throw new PricingError("Invalid supplier cost");
  const acquisition = Math.round(usd * s.usd_inr_rate * 100) / 100;
  let proposed = roundUpToStep(usd * s.usd_inr_rate * (1 + s.markup_pct / 100), s.rounding_step);
  // Never sell below acquisition cost.
  if (proposed < acquisition) proposed = roundUpToStep(acquisition, s.rounding_step);
  const profit = Math.round((proposed - acquisition) * 100) / 100;
  return {
    acquisitionCostInr: acquisition,
    proposedSellPriceInr: proposed,
    expectedProfitInr: profit,
    expectedMarginPct: proposed > 0 ? Math.round((profit / proposed) * 10000) / 100 : 0,
  };
}

/** Safe variant: null instead of throwing (for previews). */
export function tryProposeSellPrice(usd: unknown, s: SupplierPricingSettings): PriceProposal | null {
  try {
    return proposeSellPrice(Number(usd), s);
  } catch {
    return null;
  }
}

export function changePct(oldUsd: number, newUsd: number): number {
  if (!(oldUsd > 0)) return 0;
  return Math.round(((newUsd - oldUsd) / oldUsd) * 10000) / 100;
}

/** True when the supplier USD price actually moved (ignores float noise and first imports). */
export function hasSupplierPriceChanged(oldUsd: number | null | undefined, newUsd: number | null | undefined): boolean {
  if (oldUsd == null || newUsd == null) return false;
  return Math.abs(Number(oldUsd) - Number(newUsd)) > 0.00005;
}

/** A change worth an admin alert: both the % and absolute USD thresholds are met. */
export function isSignificantChange(
  baselineUsd: number | null | undefined,
  newUsd: number | null | undefined,
  t: AlertThresholds = DEFAULT_ALERT_THRESHOLDS,
): boolean {
  if (baselineUsd == null || newUsd == null) return false;
  const a = Number(baselineUsd);
  const b = Number(newUsd);
  if (!(a > 0) || !(b > 0)) return false;
  return Math.abs(b - a) >= t.min_change_usd && Math.abs(changePct(a, b)) >= t.min_change_pct;
}
