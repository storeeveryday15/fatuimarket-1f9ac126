/**
 * Provider-agnostic automatic supplier fulfilment (server-only).
 *
 * `fulfilOrder` is idempotent: the supplier order is keyed by a reference id
 * derived from the order code, so a retry can never create a duplicate.
 */

import { selectSupplierService } from "./supplier-provider";
import { getSupplierProvider, getSupportedSupplierKeys } from "./supplier-providers.server";

export type FulfilResult = { ok: boolean; status: string; message?: string; skipped?: boolean };

/** Player UID stored as "12345 (2001)" — keep only the UID part. */
export function extractPlayerUid(gameId: string | null): string | null {
  if (!gameId) return null;
  const uid = gameId.split("(")[0]?.trim();
  return uid && uid !== "n/a" ? uid : null;
}

export function referenceIdFor(orderCode: string) {
  return `FM-${orderCode}`.replace(/[^A-Za-z0-9-]/g, "").slice(0, 60);
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Maps a supplier status onto our customer-facing order status. */
function orderStatusFor(supplierStatus: string, current: string) {
  if (supplierStatus === "completed") return "completed";
  if (supplierStatus === "failed") return current;
  return "processing";
}

export async function fulfilOrder(orderCode: string): Promise<FulfilResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as AdminClient;

  const { data: order } = await admin
    .from("orders")
    .select("id, order_code, status, quantity, game_id, server_id, catalog_product_id, product_slug, tier_label")
    .eq("order_code", orderCode)
    .maybeSingle();
  if (!order) return { ok: false, status: "unknown", message: "Order not found" };

  // Already sent? Reuse the existing supplier order.
  const { data: existing } = await admin
    .from("supplier_orders")
    .select("id, status, supplier_order_id, reference_id, supplier_key")
    .eq("order_id", order.id)
    .maybeSingle();
  if (existing && existing.supplier_order_id) {
    return { ok: true, status: existing.status };
  }

  // Resolve the mapped supplier service.
  let serviceQuery = admin
    .from("supplier_services")
    .select("service_code, min_quantity, max_quantity, sort_order, active, catalog_product_id, supplier_products!inner(supplier_key)")
    .eq("active", true)
    .eq("available", true);
  serviceQuery = order.catalog_product_id
    ? serviceQuery.eq("catalog_product_id", order.catalog_product_id)
    : serviceQuery.eq("catalog_product_id", "00000000-0000-0000-0000-000000000000");
  const { data: services, error: serviceError } = await serviceQuery;
  if (serviceError) {
    console.error("[supplier] service resolution failed", { orderCode, message: serviceError.message });
    return { ok: false, status: "error", skipped: true, message: "Supplier mapping could not be resolved" };
  }
  const candidates = (services ?? [])
    .map((service: any) => ({
      serviceCode: service.service_code,
      supplierKey: service.supplier_products.supplier_key,
      minQuantity: service.min_quantity,
      maxQuantity: service.max_quantity,
      sortOrder: service.sort_order ?? 0,
    }))
    .filter((service) => !existing || service.supplierKey === existing.supplier_key);
  const service = selectSupplierService(candidates, getSupportedSupplierKeys());
  if (!service) {
    console.error("[supplier] no supported active mapping", { orderCode, catalogProductId: order.catalog_product_id });
    await admin.from("orders").update({ supplier_status: "unmapped", needs_review: true }).eq("id", order.id);
    return { ok: false, status: "unmapped", skipped: true, message: "No supported supplier service mapped" };
  }

  const provider = getSupplierProvider(service.supplierKey);
  if (!provider) return { ok: false, status: "unsupported", skipped: true, message: "Supplier is not supported" };

  const uid = extractPlayerUid(order.game_id);
  if (!uid) return { ok: false, status: "invalid", message: "Order has no player ID" };

  const referenceId = existing?.reference_id ?? referenceIdFor(order.order_code);
  const quantity = Math.min(Math.max(order.quantity ?? 1, service.minQuantity ?? 1), service.maxQuantity ?? 999);

  if (!existing) {
    const { error: insertErr } = await admin.from("supplier_orders").insert({
      order_id: order.id,
      service_code: service.serviceCode,
      reference_id: referenceId,
      supplier_key: service.supplierKey,
      status: "pending",
    });
    // A unique violation means another request is already fulfilling this order.
    if (insertErr && !String(insertErr.message).includes("duplicate")) {
      return { ok: false, status: "error", message: insertErr.message };
    }
    if (insertErr) return { ok: true, status: "pending", message: "Already being fulfilled" };
  }

  try {
    const result = await provider.createOrder({
      serviceCode: service.serviceCode,
      referenceId,
      userId: uid,
      serverId: order.server_id,
      quantity,
    });

    await admin
      .from("supplier_orders")
      .update({
        supplier_order_id: result.supplierOrderId,
        status: result.status,
        last_response: result.raw as never,
        error_message: null,
      })
      .eq("reference_id", referenceId);

    await admin
      .from("orders")
      .update({
        supplier_status: result.status,
        supplier_order_id: result.supplierOrderId,
        status: orderStatusFor(result.status, order.status),
      })
      .eq("id", order.id);

    return { ok: true, status: result.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supplier order failed";
    console.error("[supplier] create order failed", { orderCode, supplierKey: service.supplierKey, message });
    await admin
      .from("supplier_orders")
      .update({ status: "failed", error_message: message })
      .eq("reference_id", referenceId);
    await admin.from("orders").update({ supplier_status: "failed" }).eq("id", order.id);
    return { ok: false, status: "failed", message };
  }
}

/** Refreshes one supplier order from the status API and syncs the local order. */
export async function refreshSupplierOrder(referenceId: string): Promise<{ status: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as AdminClient;

  const { data: row } = await admin
    .from("supplier_orders")
    .select("id, order_id, reference_id, supplier_order_id, supplier_key, status")
    .eq("reference_id", referenceId)
    .maybeSingle();
  if (!row) return { status: "unknown" };
  if (row.status === "completed" || row.status === "failed") return { status: row.status };

  const provider = getSupplierProvider(row.supplier_key);
  if (!provider) return { status: "unsupported" };

  const res = await provider.getOrderStatus({
    referenceId: row.reference_id,
    supplierOrderId: row.supplier_order_id,
  });
  const status = provider.normalizeStatus(res.status);

  await admin
    .from("supplier_orders")
    .update({
      status,
      supplier_order_id: res.supplierOrderId ?? row.supplier_order_id,
      last_response: res.raw as never,
      ...(res.delivered ? { delivered_payload: res.delivered as never } : {}),
      ...(status === "failed" && res.message ? { error_message: res.message } : {}),
    })
    .eq("id", row.id);

  const { data: order } = await admin.from("orders").select("status").eq("id", row.order_id).maybeSingle();
  await admin
    .from("orders")
    .update({
      supplier_status: status,
      supplier_order_id: res.supplierOrderId ?? row.supplier_order_id,
      ...(res.delivered ? { delivery_details: formatDelivery(res.delivered) } : {}),
      status: orderStatusFor(status, order?.status ?? "processing"),
    })
    .eq("id", row.order_id);

  return { status };
}

/** Human-readable delivery details (codes, serials) for the customer. */
export function formatDelivery(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload.slice(0, 2000);
  try {
    return JSON.stringify(payload).slice(0, 2000);
  } catch {
    return "";
  }
}
