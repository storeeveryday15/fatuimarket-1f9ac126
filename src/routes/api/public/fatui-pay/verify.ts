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
          .select("id, order_code, status, utr, amount_inr, amount_usd, currency")
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
        if (["paid", "completed", "delivered", "processing"].includes(order.status)) {
          await finish("skipped", `Order already ${order.status}`);
          return new Response("ok", { status: 200 });
        }

        const orderAmount = Number(
          (order.currency === "INR" ? order.amount_inr : order.amount_usd) ?? 0,
        );
        const reference = event.paymentReference;

        // 1. The bank RRN must match the reference the customer submitted.
        if (order.utr && reference && order.utr.toLowerCase() !== reference.toLowerCase()) {
          await supabaseAdmin
            .from("orders")
            .update({
              status: "rejected",
              rejected_at: new Date().toISOString(),
              reason: "Bank reference does not match the submitted UTR",
              needs_review: true,
            })
            .eq("id", order.id);
          await finish("rejected", "RRN mismatch");
          return new Response("ok", { status: 200 });
        }

        // 2. The paid amount must equal the order amount exactly.
        if (event.amount == null || Math.abs(Number(event.amount) - orderAmount) > 0.009) {
          console.warn("[fatui-pay] amount mismatch", {
            event_id: event.eventId,
            order_code: order.order_code,
          });
          await supabaseAdmin
            .from("orders")
            .update({
              status: "rejected",
              rejected_at: new Date().toISOString(),
              reason: "Paid amount does not match the order amount",
              needs_review: true,
            })
            .eq("id", order.id);
          await finish("rejected", "Amount mismatch");
          return new Response("ok", { status: 200 });
        }

        // 3. The RRN may never be consumed by more than one order.
        if (reference) {
          const { data: others } = await supabaseAdmin
            .from("orders")
            .select("id, status")
            .ilike("utr", reference)
            .neq("id", order.id);
          const rows = others ?? [];
          const consumed = rows.some((o) =>
            ["paid", "processing", "completed", "delivered"].includes(o.status),
          );
          if (consumed || rows.length > 0) {
            await supabaseAdmin
              .from("orders")
              .update({
                status: consumed ? "duplicate_rrn" : order.status,
                needs_review: true,
                reason: consumed
                  ? "This payment reference was already used for another order"
                  : "Same payment reference appears on more than one order — manual review required",
              })
              .eq("id", order.id);
            await finish(consumed ? "duplicate" : "review", "RRN already present on another order");
            return new Response("ok", { status: 200 });
          }
        }

        await supabaseAdmin
          .from("orders")
          .update({
            status: "paid",
            verified_at: new Date().toISOString(),
            payment_method: "fatui_pay",
            ...(reference ? { utr: reference } : {}),
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
