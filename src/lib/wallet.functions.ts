import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MIN_TOPUP = 10;
const MAX_TOPUP = 100000;

export const createWalletTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      amount_inr: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP),
    }),
  )
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay is not configured");

    const amountPaise = Math.round(data.amount_inr * 100);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const receipt = `wallet_${context.userId.slice(0, 8)}_${Date.now().toString(36)}`.slice(0, 40);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: {
          purpose: "wallet_topup",
          user_id: context.userId,
        },
      }),
    });
    if (!res.ok) {
      console.error("Wallet topup order failed", res.status, await res.text().catch(() => ""));
      throw new Error("Payment gateway error");
    }
    const rzp = (await res.json()) as { id: string; amount: number; currency: string };
    return { order_id: rzp.id, amount: rzp.amount, currency: rzp.currency, key_id: keyId };
  });

export const verifyWalletTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay is not configured");

    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(data.razorpay_signature, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { verified: false as const };

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(data.razorpay_order_id)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!rzpRes.ok) return { verified: false as const };
    const rzpOrder = (await rzpRes.json()) as {
      amount?: number;
      currency?: string;
      status?: string;
      notes?: { purpose?: string; user_id?: string };
    };
    if (
      rzpOrder.currency !== "INR" ||
      rzpOrder.notes?.purpose !== "wallet_topup" ||
      rzpOrder.notes?.user_id !== context.userId ||
      !rzpOrder.amount
    ) {
      return { verified: false as const };
    }

    const payRes = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(data.razorpay_payment_id)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!payRes.ok) return { verified: false as const };
    const payment = (await payRes.json()) as {
      amount?: number;
      currency?: string;
      status?: string;
      order_id?: string;
    };
    if (
      payment.order_id !== data.razorpay_order_id ||
      payment.currency !== "INR" ||
      Number(payment.amount) !== Number(rzpOrder.amount) ||
      !["authorized", "captured"].includes(String(payment.status))
    ) {
      return { verified: false as const };
    }

    const amountInr = Number(rzpOrder.amount) / 100;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: if we've already credited this payment, return current balance.
    const { data: existing } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("type", "topup")
      .eq("description", `Razorpay ${data.razorpay_payment_id}`)
      .maybeSingle();

    if (!existing) {
      const { data: prof, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("wallet_balance")
        .eq("id", context.userId)
        .maybeSingle();
      if (profErr) throw new Error("Failed to load profile");
      const current = Number(prof?.wallet_balance ?? 0);
      const next = current + amountInr;
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ wallet_balance: next })
        .eq("id", context.userId);
      if (updErr) throw new Error("Failed to credit wallet");

      await supabaseAdmin.from("wallet_transactions").insert({
        user_id: context.userId,
        type: "topup",
        amount_inr: amountInr,
        description: `Razorpay ${data.razorpay_payment_id}`,
      });
    }

    const { data: prof2 } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", context.userId)
      .maybeSingle();

    return {
      verified: true as const,
      balance: Number(prof2?.wallet_balance ?? 0),
      amount_inr: amountInr,
    };
  });
