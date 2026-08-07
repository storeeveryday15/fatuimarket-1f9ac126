/**
 * Automatic FlashTopup fulfilment (server-only).
 *
 * `fulfilOrder` is idempotent: the supplier order is keyed by a reference id
 * derived from the order code, so a retry can never create a duplicate.
 */

import { createSupplierOrder, fetchOrderStatus, mapSupplierStatus } from "./flashtopup.server";

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
    .select("id, status, supplier_order_id, reference_id")
    .eq("order_id", order.id)
    .maybeSingle();
  if (existing && existing.supplier_order_id) {
    return { ok: true, status: existing.status };
  }

  // Resolve the mapped supplier service.
  let serviceQuery = admin
    .from("supplier_services")
    .select("service_code, min_quantity, max_quantity, active, catalog_product_id")
    .eq("active", true)
    .limit(1);
  serviceQuery = order.catalog_product_id
    ? serviceQuery.eq("catalog_product_id", order.catalog_product_id)
    : serviceQuery.eq("catalog_product_id", "00000000-0000-0000-0000-000000000000");
  const { data: services } = await serviceQuery;
  const service = services?.[0];
  if (!service) return { ok: false, status: "unmapped", skipped: true, message: "No supplier service mapped" };

  const uid = extractPlayerUid(order.game_id);
  if (!uid) return { ok: false, status: "invalid", message: "Order has no player ID" };

  const referenceId = existing?.reference_id ?? referenceIdFor(order.order_code);
  const quantity = Math.min(Math.max(order.quantity ?? 1, service.min_quantity ?? 1), service.max_quantity ?? 999);

  if (!existing) {
    const { error: insertErr } = await admin.from("supplier_orders").insert({
      order_id: order.id,
      service_code: service.service_code,
      reference_id: referenceId,
      status: "pending",
    });
    // A unique violation means another request is already fulfilling this order.
    if (insertErr && !String(insertErr.message).includes("duplicate")) {
      return { ok: false, status: "error", message: insertErr.message };
    }
    if (insertErr) return { ok: true, status: "pending", message: "Already being fulfilled" };
  }

  try {
    const result = await createSupplierOrder({
      service_code: service.service_code,
      reference_id: referenceId,
      user_id: uid,
      server_id: order.server_id,
      quantity,
    });

    await admin
      .from("supplier_orders")
      .update({
        supplier_order_id: result.supplier_order_id,
        status: result.status,
        last_response: result.raw as never,
        error_message: null,
      })
      .eq("reference_id", referenceId);

    await admin
      .from("orders")
      .update({
        supplier_status: result.status,
        supplier_order_id: result.supplier_order_id,
        status: orderStatusFor(result.status, order.status),
      })
      .eq("id", order.id);

    return { ok: true, status: result.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supplier order failed";
    console.error("[flashtopup] create order failed", { orderCode, message });
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
    .select("id, order_id, reference_id, supplier_order_id, status")
    .eq("reference_id", referenceId)
    .maybeSingle();
  if (!row) return { status: "unknown" };
  if (row.status === "completed" || row.status === "failed") return { status: row.status };

  const res = await fetchOrderStatus({
    reference_id: row.reference_id,
    supplier_order_id: row.supplier_order_id,
  });
  const status = mapSupplierStatus(res.status);

  await admin
    .from("supplier_orders")
    .update({
      status,
      supplier_order_id: res.supplier_order_id ?? row.supplier_order_id,
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
      supplier_order_id: res.supplier_order_id ?? row.supplier_order_id,
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
