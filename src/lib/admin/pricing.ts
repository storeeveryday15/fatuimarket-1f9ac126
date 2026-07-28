/**
 * Smart Price Engine
 * ------------------
 * Pure, dependency-free pricing maths shared by the admin UI and the
 * server-side auto-pricing job. Keeping it pure means the recommended price
 * shown in the dashboard is byte-for-byte the price the cron job would apply.
 */

export type PriceRounding =
  | "none"
  | "nearest_1"
  | "nearest_5"
  | "nearest_10"
  | "charm_9"; // e.g. 129, 249 — ends in 9

export type PricingRules = {
  min_profit_inr: number;
  max_profit_inr: number;
  min_profit_pct: number;
  max_profit_pct: number;
  price_rounding: PriceRounding;
};

export type PricingMode = "manual" | "suggest" | "auto";

export const DEFAULT_RULES: PricingRules = {
  min_profit_inr: 5,
  max_profit_inr: 200,
  min_profit_pct: 3,
  max_profit_pct: 40,
  price_rounding: "nearest_1",
};

/** Apply the configured rounding strategy to a raw price. */
export function roundPrice(value: number, rounding: PriceRounding): number {
  if (!Number.isFinite(value)) return 0;
  switch (rounding) {
    case "none":
      return Math.round(value * 100) / 100;
    case "nearest_5":
      return Math.round(value / 5) * 5;
    case "nearest_10":
      return Math.round(value / 10) * 10;
    case "charm_9": {
      const base = Math.max(9, Math.ceil(value));
      // Snap up to the next number ending in 9 (9, 19, 29, ...).
      return base % 10 === 9 ? base : base + ((9 - (base % 10)) + 10) % 10;
    }
    case "nearest_1":
    default:
      return Math.round(value);
  }
}

export type PriceComputation = {
  cost: number;
  currentPrice: number;
  profit: number;
  profitPct: number;
  recommendedPrice: number;
  recommendedProfit: number;
  recommendedProfitPct: number;
  /** True when the current price violates a rule and should be changed. */
  needsChange: boolean;
  reason: string;
};

/**
 * Compute profit for the current price and the recommended price under the
 * configured rules. Hard invariants:
 *  - never below supplier cost
 *  - never above the configured maximum profit (absolute or percentage)
 *  - always at least the configured minimum profit when cost is known
 */
export function computePricing(
  cost: number,
  currentPrice: number,
  rules: PricingRules,
): PriceComputation {
  const safeCost = Math.max(0, Number(cost) || 0);
  const price = Math.max(0, Number(currentPrice) || 0);

  const profit = price - safeCost;
  const profitPct = safeCost > 0 ? (profit / safeCost) * 100 : 0;

  // Floor / ceiling derived from both absolute and percentage rules.
  const floor = Math.max(
    safeCost + rules.min_profit_inr,
    safeCost * (1 + rules.min_profit_pct / 100),
  );
  const ceiling = Math.min(
    safeCost + rules.max_profit_inr,
    safeCost * (1 + rules.max_profit_pct / 100),
  );

  // If the rules conflict (floor above ceiling) the floor always wins so we
  // never recommend selling at a loss.
  const target = floor > ceiling ? floor : Math.min(Math.max(price, floor), ceiling);
  let recommended = roundPrice(target, rules.price_rounding);
  if (recommended < safeCost) recommended = roundPrice(floor, "nearest_1");

  const recommendedProfit = recommended - safeCost;
  const recommendedProfitPct = safeCost > 0 ? (recommendedProfit / safeCost) * 100 : 0;

  let reason = "Price is within the configured profit band.";
  if (safeCost <= 0) reason = "No supplier cost recorded — set a cost to enable pricing rules.";
  else if (price < safeCost) reason = "Current price is BELOW supplier cost.";
  else if (profit < rules.min_profit_inr) reason = "Profit is below the minimum profit rule.";
  else if (profitPct < rules.min_profit_pct) reason = "Margin is below the minimum margin rule.";
  else if (profit > rules.max_profit_inr) reason = "Profit exceeds the maximum profit rule.";
  else if (profitPct > rules.max_profit_pct) reason = "Margin exceeds the maximum margin rule.";

  const needsChange = safeCost > 0 && recommended !== roundPrice(price, rules.price_rounding);

  return {
    cost: safeCost,
    currentPrice: price,
    profit,
    profitPct,
    recommendedPrice: recommended,
    recommendedProfit,
    recommendedProfitPct,
    needsChange,
    reason,
  };
}

/** Human-readable margin health used for badges across the dashboard. */
export function marginHealth(profitPct: number, rules: PricingRules): "loss" | "low" | "healthy" | "high" {
  if (profitPct < 0) return "loss";
  if (profitPct < rules.min_profit_pct) return "low";
  if (profitPct > rules.max_profit_pct) return "high";
  return "healthy";
}

export const inr = (n: number | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
