/**
 * Pure decision rules for supplier price alerts and approvals. Shared by
 * catalog sync and the admin price monitor so behaviour is testable.
 */
import {
  changePct,
  isSignificantChange,
  proposeSellPrice,
  type AlertThresholds,
  type SupplierPricingSettings,
} from "./supplier-pricing";

export type PricedService = {
  id: string;
  customer_price_inr: number | null;
  priced_at_supplier_usd: number | null;
};

export type AlertDecision =
  | { kind: "none" }
  | { kind: "supersede" }
  | {
      kind: "alert";
      baselineUsd: number;
      newUsd: number;
      changePct: number;
      previousCustomerPriceInr: number;
      proposal: ReturnType<typeof proposeSellPrice>;
    };

/**
 * Alerts are only raised for packages that already have an approved customer
 * price, comparing against the supplier cost that price was approved at (so
 * many tiny moves still add up). Unpriced packages never raise alerts.
 */
export function decidePriceAlert(
  service: PricedService,
  newUsd: number | null,
  settings: SupplierPricingSettings,
  thresholds: AlertThresholds,
): AlertDecision {
  if (service.customer_price_inr == null || service.priced_at_supplier_usd == null) return { kind: "none" };
  if (newUsd == null || !(newUsd > 0)) return { kind: "none" };
  const baseline = Number(service.priced_at_supplier_usd);
  if (!isSignificantChange(baseline, newUsd, thresholds)) return { kind: "supersede" };
  return {
    kind: "alert",
    baselineUsd: baseline,
    newUsd,
    changePct: changePct(baseline, newUsd),
    previousCustomerPriceInr: Number(service.customer_price_inr),
    proposal: proposeSellPrice(newUsd, settings),
  };
}

export type ApprovalCheck = { ok: true } | { ok: false; reason: string };

/** An alert may only be approved while it still describes the live package. */
export function checkChangeApproval(
  change: { status: string; kind: string; previous_customer_price_inr: number | null; new_supplier_price_usd: number },
  service: { active: boolean; customer_price_inr: number | null; supplier_price: number | null } | null,
): ApprovalCheck {
  if (change.status !== "pending") return { ok: false, reason: "Alert is no longer pending" };
  if (change.kind !== "change") return { ok: false, reason: "Legacy alerts cannot be approved" };
  if (!service || !service.active) return { ok: false, reason: "Package is not active" };
  if (service.customer_price_inr == null) return { ok: false, reason: "Package has no approved price" };
  if (Number(service.customer_price_inr) !== Number(change.previous_customer_price_inr))
    return { ok: false, reason: "Customer price changed since the alert" };
  if (service.supplier_price == null || Math.abs(Number(service.supplier_price) - Number(change.new_supplier_price_usd)) > 0.00005)
    return { ok: false, reason: "Supplier cost changed since the alert" };
  return { ok: true };
}

/** An unpriced package is eligible for an initial price only with a valid USD cost. */
export function checkInitialPricing(service: {
  active: boolean;
  customer_price_inr: number | null;
  supplier_price: number | null;
  currency: string | null;
}): ApprovalCheck {
  if (!service.active) return { ok: false, reason: "Package is not active" };
  if (service.customer_price_inr != null) return { ok: false, reason: "Package already priced" };
  if (service.currency && service.currency.toUpperCase() !== "USD") return { ok: false, reason: "Non-USD supplier cost" };
  if (service.supplier_price == null || !(Number(service.supplier_price) > 0)) return { ok: false, reason: "Missing supplier cost" };
  return { ok: true };
}
