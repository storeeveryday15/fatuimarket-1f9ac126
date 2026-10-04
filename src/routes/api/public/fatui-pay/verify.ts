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
          // A prior delivery may have been safely recorded but not processed
          // (for example, a transient parser/database failure). Atomically
          // reclaim only retryable rows; completed/in-flight events stay no-ops.
          const { data: reclaimed } = await supabaseAdmin
            .from("payment_webhook_events")
            .update({
              status: "received",
              event_type: event.eventType || null,
              order_code: event.orderCode,
              payment_reference: event.paymentReference,
              payload: payload as never,
              error_message: null,
              processed_at: null,
            })
            .eq("provider", "fatui_pay")
            .eq("event_id", event.eventId)
            .in("status", ["ignored", "error", "unmatched"])
            .select("event_id")
            .maybeSingle();
          if (reclaimed) {
            console.info("[fatui-pay] retrying previously unprocessed event", { event_id: event.eventId });
          } else {
          console.info("[fatui-pay] duplicate event ignored", { event_id: event.eventId });
          return new Response("ok", { status: 200 });
          }
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

        // Wallet top-ups use the same signed verification event and shared RRN registry.
        if (event.orderCode.startsWith("WLT-")) {
          if (!event.paymentReference || event.amount == null) {
            await finish("error", "Wallet event is missing payment reference or amount");
            return new Response("Missing payment details", { status: 400 });
          }
          const { data: result, error } = await (supabaseAdmin.rpc as unknown as (
            fn: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: { result?: string } | null; error: { message: string } | null }>)(
            "finalize_fatui_wallet_topup",
            { _topup_code: event.orderCode, _rrn: event.paymentReference, _amount: event.amount, _event_id: event.eventId },
          );
          if (error) {
            console.error("[fatui-pay] wallet finalization failed", { event_id: event.eventId });
            await finish("error", "Wallet finalization failed");
            return new Response("Processing failed", { status: 500 });
          }
          const outcome = result?.result ?? "unknown";
          await finish(outcome === "credited" || outcome === "already_paid" ? "processed" : outcome, `wallet:${outcome}`);
          return new Response("ok", { status: 200 });
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

        const orderAmount = Number(
          (order.currency === "INR" ? order.amount_inr : order.amount_usd) ?? 0,
        );
        const reference = event.paymentReference;

        if (!reference || event.amount == null || orderAmount <= 0) {
          await finish("error", "Event is missing verifiable payment details");
          return new Response("Missing payment details", { status: 400 });
        }
        const { data: paymentResult, error: paymentError } = await (supabaseAdmin.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: { result?: string } | null; error: { message: string } | null }>)(
          "register_fatui_order_payment",
          { _order_id: order.id, _rrn: reference, _amount: event.amount, _event_id: event.eventId },
        );
        if (paymentError) {
          console.error("[fatui-pay] order finalization failed", { event_id: event.eventId });
          await finish("error", "Order finalization failed");
          return new Response("Processing failed", { status: 500 });
        }
        const outcome = paymentResult?.result ?? "unknown";
        if (outcome !== "paid") {
          await finish(outcome === "already_paid" ? "skipped" : outcome, outcome);
          return new Response("ok", { status: 200 });
        }

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
