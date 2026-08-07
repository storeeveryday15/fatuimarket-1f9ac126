import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-only Razorpay integration using the REST API (no SDK required).
// Secrets (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are read inside handlers.
// Amount is derived server-side from the database order — NEVER trusted from the client.
// Both entry points require an authenticated caller who owns the order.

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      order_code: z.string().min(1).max(64),
    }),
  )
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials are not configured");
    }

    // Look up the authoritative order server-side.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, amount_inr, currency, region, product_name, status, user_id")
      .eq("order_code", data.order_code)
      .maybeSingle();

    if (error) throw new Error("Failed to load order");
    if (!order) throw new Error("Order not found");
    if (order.user_id !== context.userId) throw new Error("Order not found");
    if (order.currency !== "INR" || order.region !== "IN") {
      throw new Error("Razorpay is only available for INR orders");
    }
    if (!["pending_payment"].includes(order.status)) {
      throw new Error("Order is not awaiting payment");
    }

    if (!order.amount_inr || Number(order.amount_inr) <= 0) {
      throw new Error("Order amount is invalid");
    }

    const amountPaise = Math.round(Number(order.amount_inr) * 100);
    if (amountPaise < 100) throw new Error("Order amount is below minimum");

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const toAscii = (s: string) => s.replace(/[^\x20-\x7E]/g, "").trim();
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: toAscii(order.order_code).slice(0, 40),
        notes: {
          order_code: toAscii(order.order_code),
          product: toAscii(order.product_name ?? "").slice(0, 250),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Razorpay order creation failed", res.status, text);
      throw new Error("Payment gateway error");
    }

    const rzp = (await res.json()) as { id: string; amount: number; currency: string };

    // Mark the payment method server-side. razorpay_order_id is re-validated
    // in verifyRazorpayPayment via a live Razorpay API lookup, so we don't rely
    // on the client echoing back a trusted value.
    await supabaseAdmin
      .from("orders")
      .update({ payment_method: "razorpay" })
      .eq("id", order.id);

    return {
      order_id: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
      key_id: keyId,
    };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
      order_code: z.string().min(1).max(64),
    }),
  )
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay is not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_code, amount_inr, currency, region, status, user_id")
      .eq("order_code", data.order_code)
      .maybeSingle();
    if (error) throw new Error("Failed to load order");
    if (!order) return { verified: false as const };
    if (order.user_id !== context.userId) return { verified: false as const };
    if (order.currency !== "INR" || !order.amount_inr) {
      return { verified: false as const };

    }

    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(data.razorpay_signature, "hex");
    const sigValid = a.length === b.length && timingSafeEqual(a, b);
    if (!sigValid) return { verified: false as const };

    // Cross-check the Razorpay order amount against our DB amount to defeat
    // client-side amount tampering (i.e. a razorpay_order_id that was created
    // for a smaller amount than the actual order).
    const expectedPaise = Math.round(Number(order.amount_inr) * 100);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(data.razorpay_order_id)}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!rzpRes.ok) {
      console.error("Razorpay order lookup failed", rzpRes.status);
      return { verified: false as const };
    }
    const rzpOrder = (await rzpRes.json()) as { amount?: number; currency?: string; status?: string };
    if (rzpOrder.currency !== "INR" || Number(rzpOrder.amount) !== expectedPaise) {
      console.error("Razorpay amount mismatch", { expectedPaise, got: rzpOrder.amount });
      return { verified: false as const };
    }

    // Also confirm the payment itself was actually captured/authorized for the right amount.
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(data.razorpay_payment_id)}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!payRes.ok) return { verified: false as const };
    const payment = (await payRes.json()) as { amount?: number; currency?: string; status?: string; order_id?: string };
    if (
      payment.order_id !== data.razorpay_order_id ||
      payment.currency !== "INR" ||
      Number(payment.amount) !== expectedPaise ||
      !["authorized", "captured"].includes(String(payment.status))
    ) {
      return { verified: false as const };
    }

    // Payment is real — record it and hand the order to the supplier.
    await supabaseAdmin
      .from("orders")
      .update({
        utr: data.razorpay_payment_id,
        payment_method: "razorpay",
        status: "pending_verification",
      })
      .eq("id", order.id);

    let fulfilment: { ok: boolean; status: string; skipped?: boolean } = {
      ok: false,
      status: "skipped",
      skipped: true,
    };
    try {
      const { fulfilOrder } = await import("./flashtopup-fulfil.server");
      fulfilment = await fulfilOrder(order.order_code);
    } catch (err) {
      console.error("[fulfilment] auto order failed", err instanceof Error ? err.message : err);
    }

    return {
      verified: true as const,
      payment_id: data.razorpay_payment_id,
      order_id: data.razorpay_order_id,
      fulfilment_status: fulfilment.status,
      auto_fulfilled: fulfilment.ok && !fulfilment.skipped,
    };
  });

