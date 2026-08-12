/** Service catalogue sync for FlashTopup (server-only). */

import { fetchAllServices, normalizeService, extractAvailability, extractDescription } from "./flashtopup.server";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

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
    .select("service_code")
    .eq("supplier_product_id", product.id);
  const existingCodes = new Set((existing ?? []).map((r: { service_code: string }) => r.service_code));

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
