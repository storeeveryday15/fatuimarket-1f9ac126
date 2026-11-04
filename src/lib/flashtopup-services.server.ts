/** Service catalogue sync for FlashTopup (server-only). */

import { fetchAllServices, normalizeService, extractAvailability, extractDescription } from "./flashtopup.server";
import { DEFAULT_SUPPLIER_PRICING, hasSupplierPriceChanged, proposeSellPrice, type SupplierPricingSettings } from "./supplier-pricing";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

type ExistingService = { id: string; service_code: string; supplier_price: number | null; sell_price_inr: number | null };

async function loadPricingSettings(admin: AdminClient): Promise<SupplierPricingSettings> {
  const { data } = await admin.from("supplier_pricing_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SUPPLIER_PRICING;
  return {
    usd_inr_rate: Number(data.usd_inr_rate),
    markup_pct: Number(data.markup_pct),
    rounding_step: Number(data.rounding_step) as 1 | 5 | 10,
  };
}

/** Queue pending price proposals for packages whose USD supplier price moved. */
async function recordPriceChanges(
  admin: AdminClient,
  product: { id: string; product_code: string },
  existing: ExistingService[],
  rows: Array<{ service_code: string; service_name: string; supplier_price: number | null; currency: string | null }>,
) {
  const byCode = new Map(existing.map((e) => [e.service_code, e]));
  const changed = rows
    .filter((r) => !r.currency || r.currency.toUpperCase() === "USD")
    .map((r) => ({ r, prev: byCode.get(r.service_code) }))
    .filter(({ r, prev }) => prev && hasSupplierPriceChanged(prev.supplier_price, r.supplier_price));
  if (!changed.length) return;

  const settings = await loadPricingSettings(admin);
  const { data: prod } = await admin.from("supplier_products").select("display_name, name").eq("id", product.id).maybeSingle();
  const ids = changed.map(({ prev }) => prev!.id);
  // Older pending proposals for the same package are replaced by the newest one.
  await admin.from("supplier_price_changes").update({ status: "superseded" }).in("supplier_service_id", ids).eq("status", "pending");

  await admin.from("supplier_price_changes").insert(
    changed.map(({ r, prev }) => {
      const p = proposeSellPrice(Number(r.supplier_price), settings);
      return {
        supplier_service_id: prev!.id,
        product_name: prod?.display_name ?? prod?.name ?? product.product_code,
        service_name: r.service_name,
        service_code: r.service_code,
        old_supplier_price_usd: prev!.supplier_price,
        new_supplier_price_usd: Number(r.supplier_price),
        usd_inr_rate: settings.usd_inr_rate,
        markup_pct: settings.markup_pct,
        rounding_step: settings.rounding_step,
        acquisition_cost_inr: p.acquisitionCostInr,
        current_sell_price_inr: prev!.sell_price_inr,
        proposed_sell_price_inr: p.proposedSellPriceInr,
        expected_profit_inr: p.expectedProfitInr,
        expected_margin_pct: p.expectedMarginPct,
      };
    }),
  );
}

/** Structured, sanitized failure record shown to admins. */
export type ServiceSyncFailure = {
  product_code: string;
  product_type: string | null;
  http_status: number | null;
  supplier_code: string | null;
  supplier_message: string;
  request_id: string | null;
};

export type ServiceSyncResult = {
  products: number;
  services: number;
  deactivated: number;
  failed: number;
  failures: ServiceSyncFailure[];
};

/** Syncs services for one supplier product. Never throws. */
export async function syncServicesForProduct(
  admin: AdminClient,
  product: { id: string; product_code: string; product_type: string | null },
): Promise<{
  ok: boolean;
  fetched: number;
  inserted: number;
  deactivated: number;
  status: number | null;
  error: string | null;
  errorCode: string | null;
  requestId: string | null;
}> {
  const fetched = await fetchAllServices(product.product_code, product.product_type);
  if (!fetched.ok) {
    return {
      ok: false,
      fetched: 0,
      inserted: 0,
      deactivated: 0,
      status: fetched.status,
      error: fetched.error,
      errorCode: fetched.errorCode,
      requestId: fetched.requestId,
    };
  }

  const rows = fetched.rows
    .map((r) => {
      const norm = normalizeService(r);
      if (!norm) return null;
      return { ...norm, available: extractAvailability(r), description: extractDescription(r) };
    })
    .filter(Boolean) as Array<
    NonNullable<ReturnType<typeof normalizeService>> & { available: boolean; description: string | null }
  >;

  const { data: existing } = await admin
    .from("supplier_services")
    .select("id, service_code, supplier_price, sell_price_inr")
    .eq("supplier_product_id", product.id);
  const existingCodes = new Set((existing ?? []).map((r: { service_code: string }) => r.service_code));

  // Price-change detection (preview only — customer prices are never touched here).
  try {
    await recordPriceChanges(admin, product, existing ?? [], rows);
  } catch (e) {
    console.error("[flashtopup] price-change detection failed", e instanceof Error ? e.message : e);
  }

  const now = new Date().toISOString();
  if (rows.length) {
    const { error } = await admin.from("supplier_services").upsert(
      rows.map((r, index) => ({
        supplier_product_id: product.id,
        service_code: r.service_code,
        service_name: r.service_name,
        supplier_price: r.supplier_price,
        currency: r.currency,
        min_quantity: r.min_quantity,
        max_quantity: r.max_quantity,
        validation_code: r.validation_code,
        input_fields: r.input_fields as never,
        requires_validation: r.requires_validation,
        available: r.available,
        description: r.description,
        sort_order: index,
        raw: r.raw as never,
        active: true,
        updated_at: now,
      })),
      { onConflict: "supplier_product_id,service_code" },
    );
    if (error) {
      return {
        ok: false,
        fetched: rows.length,
        inserted: 0,
        deactivated: 0,
        status: null,
        error: `Database upsert failed: ${error.message}`,
        errorCode: "DB_UPSERT_FAILED",
        requestId: null,
      };
    }
  }

  const incoming = new Set(rows.map((r) => r.service_code));
  const gone = [...existingCodes].filter((c) => !incoming.has(c));
  if (gone.length) {
    await admin
      .from("supplier_services")
      .update({ active: false, available: false })
      .eq("supplier_product_id", product.id)
      .in("service_code", gone);
  }

  return {
    ok: true,
    fetched: fetched.rows.length,
    inserted: rows.length,
    deactivated: gone.length,
    status: 200,
    error: null,
    errorCode: null,
    requestId: null,
  };
}

/** Pulls services for every active supplier product and upserts them. */
export async function syncServicesForAllProducts(admin: AdminClient): Promise<ServiceSyncResult> {
  const { data: products } = await admin
    .from("supplier_products")
    .select("id, product_code, product_type")
    .eq("supplier_key", "flashtopup")
    .eq("active", true);

  const list = products ?? [];
  let services = 0;
  let deactivated = 0;
  const failures: ServiceSyncFailure[] = [];

  for (const product of list) {
    const result = await syncServicesForProduct(admin, product);
    if (!result.ok) {
      const failure: ServiceSyncFailure = {
        product_code: product.product_code,
        product_type: product.product_type,
        http_status: result.status,
        supplier_code: result.errorCode,
        supplier_message: result.error ?? "Unknown supplier error",
        request_id: result.requestId,
      };
      // Sanitized failure log — the rest of the catalog keeps syncing.
      console.error("[flashtopup] service sync failed", failure);
      failures.push(failure);
      continue;
    }
    services += result.inserted;
    deactivated += result.deactivated;
  }

  return { products: list.length, services, deactivated, failed: failures.length, failures };
}
