/**
 * Supplier price proposal maths (pure). Used by catalog sync to build
 * admin-only price-change previews. Never applied to customers automatically.
 */

export type SupplierPricingSettings = {
  usd_inr_rate: number;
  markup_pct: number;
  rounding_step: 1 | 5 | 10;
};

export const DEFAULT_SUPPLIER_PRICING: SupplierPricingSettings = {
  usd_inr_rate: 111.1111,
  markup_pct: 15,
  rounding_step: 10,
};

export type PriceProposal = {
  acquisitionCostInr: number;
  proposedSellPriceInr: number;
  expectedProfitInr: number;
  expectedMarginPct: number;
};

/** Round UP to the step; tiny epsilon absorbs float noise (229.99997 → 230). */
export function roundUpToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value / step - 1e-6) * step;
}

export function proposeSellPrice(usd: number, s: SupplierPricingSettings): PriceProposal {
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

/** True when the supplier USD price actually moved (ignores float noise and first imports). */
export function hasSupplierPriceChanged(oldUsd: number | null | undefined, newUsd: number | null | undefined): boolean {
  if (oldUsd == null || newUsd == null) return false;
  return Math.abs(Number(oldUsd) - Number(newUsd)) > 0.00005;
}
