import { createFileRoute } from "@tanstack/react-router";

/**
 * Fatui Pay Verify — verified-payment webhook receiver.
 *
 * Security model:
 *  - The caller is authenticated only by the HMAC signature over the raw body.
 *  - Duplicate deliveries are ignored via a unique (provider, event_id) row.
 *  - Fulfilment runs only for a genuine payment.verified event.
 *  - The shared secret is read server-side per request and never logged.
 *
 * The receiver stays inert (503) until FATUI_PAY_WEBHOOK_ENABLED is "true".
 */
export const Route = createFileRoute("/api/public/fatui-pay/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          isWebhookEnabled,
          verifyPaymentSignature,
          parsePaymentEvent,
          isVerifiedPayment,
        } = await import("@/lib/fatui-pay.server");

        if (!isWebhookEnabled()) {
          return new Response("Webhook disabled", { status: 503 });
        }

        const rawBody = await request.text();
        const signature =
          request.headers.get("x-fatui-signature") ??
          request.headers.get("x-webhook-signature") ??
          request.headers.get("x-signature");

        if (!(await verifyPaymentSignature(rawBody, signature))) {
          console.warn("[fatui-pay] rejected: invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, any>;
        try {
          payload = JSON.parse(rawBody) as Record<string, any>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = parsePaymentEvent(payload);
        if (!event.eventId) return new Response("Missing event id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: the unique (provider, event_id) makes a replay a no-op.
        const { error: dupeError } = await supabaseAdmin.from("payment_webhook_events").insert({
          provider: "fatui_pay",
          event_id: event.eventId,
          event_type: event.eventType || null,
          order_code: event.orderCode,
          payment_reference: event.paymentReference,
          payload: payload as never,
        });
        if (dupeError) {
          console.info("[fatui-pay] duplicate event ignored", { event_id: event.eventId });
          return new Response("ok", { status: 200 });
        }

        const finish = async (status: string, message?: string) => {
          await supabaseAdmin
            .from("payment_webhook_events")
            .update({ status, error_message: message ?? null, processed_at: new Date().toISOString() })
            .eq("provider", "fatui_pay")
            .eq("event_id", event.eventId);
        };

        // Anything that is not an explicitly verified payment is recorded and dropped.
        if (!isVerifiedPayment(event)) {
          console.info("[fatui-pay] non-verified event skipped", {
            event_id: event.eventId,
            event_type: event.eventType,
            payment_status: event.paymentStatus,
          });
          await finish("ignored", "Event is not a verified payment");
          return new Response("ok", { status: 200 });
        }

        if (!event.orderCode) {
          await finish("error", "Event has no order reference");
          return new Response("Missing order reference", { status: 400 });
        }

        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .select("id, order_code, status, amount_inr, currency")
          .eq("order_code", event.orderCode)
          .maybeSingle();

        if (orderError) {
          await finish("error", "Order lookup failed");
          return new Response("Lookup failed", { status: 500 });
        }
        if (!order) {
          console.warn("[fatui-pay] no matching order", { event_id: event.eventId, order_code: event.orderCode });
          await finish("unmatched", "No matching order");
          return new Response("ok", { status: 200 });
        }

        // Guard against re-processing an order that is already paid/fulfilled.
        if (["completed", "processing", "pending_verification"].includes(order.status)) {
          await finish("skipped", `Order already ${order.status}`);
          return new Response("ok", { status: 200 });
        }

        await supabaseAdmin
          .from("orders")
          .update({
            status: "pending_verification",
            payment_method: "fatui_pay",
            ...(event.paymentReference ? { utr: event.paymentReference } : {}),
          })
          .eq("id", order.id);

        let fulfilStatus = "skipped";
        try {
          const { fulfilOrder } = await import("@/lib/flashtopup-fulfil.server");
          const result = await fulfilOrder(order.order_code);
          fulfilStatus = result.status;
          console.info("[fatui-pay] fulfilment attempted", {
            event_id: event.eventId,
            order_code: order.order_code,
            status: result.status,
          });
        } catch (err) {
          fulfilStatus = "error";
          console.error("[fatui-pay] fulfilment failed", {
            event_id: event.eventId,
            order_code: order.order_code,
            message: err instanceof Error ? err.message : "unknown error",
          });
        }

        await finish("processed", `fulfilment:${fulfilStatus}`);
        return new Response("ok", { status: 200 });
      },
    },
  },
});
