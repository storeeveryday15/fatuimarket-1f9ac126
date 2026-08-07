import { createFileRoute } from "@tanstack/react-router";

/**
 * FlashTopup delivery webhook.
 *
 * Public endpoint: the caller is authenticated purely by the HMAC signature
 * over the raw body. Duplicate deliveries are ignored via `event_id`.
 */
export const Route = createFileRoute("/api/public/flashtopup/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature =
          request.headers.get("x-ft-signature") ??
          request.headers.get("x-signature") ??
          request.headers.get("x-webhook-signature");

        const { verifyWebhookSignature, mapSupplierStatus } = await import("@/lib/flashtopup.server");
        if (!(await verifyWebhookSignature(rawBody, signature))) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, any>;
        try {
          payload = JSON.parse(rawBody) as Record<string, any>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const body = (payload?.data ?? payload) as Record<string, any>;
        const eventId = String(
          payload?.event_id ?? payload?.eventId ?? body?.event_id ?? body?.reference_id ?? "",
        ).trim();
        const referenceId = String(body?.reference_id ?? body?.referenceId ?? "").trim();
        if (!eventId || !referenceId) return new Response("Missing event data", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Dedupe: the unique event_id makes a replay a no-op.
        const { error: dupeError } = await supabaseAdmin
          .from("supplier_webhook_events")
          .insert({ event_id: eventId, payload: payload as never });
        if (dupeError) return new Response("ok", { status: 200 });

        const status = mapSupplierStatus(body?.status ?? body?.order_status);
        const delivered = body?.delivery ?? body?.codes ?? body?.sn ?? body?.serial ?? null;
        const supplierOrderId = body?.order_id ?? body?.orderId ?? null;

        const { data: supplierOrder } = await supabaseAdmin
          .from("supplier_orders")
          .select("id, order_id")
          .eq("reference_id", referenceId)
          .maybeSingle();
        if (!supplierOrder) return new Response("ok", { status: 200 });

        const { formatDelivery } = await import("@/lib/flashtopup-fulfil.server");

        await supabaseAdmin
          .from("supplier_orders")
          .update({
            status,
            supplier_order_id: supplierOrderId ? String(supplierOrderId) : undefined,
            last_response: payload as never,
            ...(delivered ? { delivered_payload: delivered as never } : {}),
            ...(status === "failed" ? { error_message: String(body?.message ?? "Supplier reported a failure") } : {}),
          })
          .eq("id", supplierOrder.id);

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("status")
          .eq("id", supplierOrder.order_id)
          .maybeSingle();

        await supabaseAdmin
          .from("orders")
          .update({
            supplier_status: status,
            ...(supplierOrderId ? { supplier_order_id: String(supplierOrderId) } : {}),
            ...(delivered ? { delivery_details: formatDelivery(delivered) } : {}),
            ...(status === "completed" ? { status: "completed" } : {}),
            ...(status === "processing" && order?.status !== "completed" ? { status: "processing" } : {}),
          })
          .eq("id", supplierOrder.order_id);

        return new Response("ok", { status: 200 });
      },
    },
  },
});
