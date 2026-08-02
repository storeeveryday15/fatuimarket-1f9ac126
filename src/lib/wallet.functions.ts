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

    // Atomic + idempotent: the DB function inserts a uniquely-keyed ledger row
    // and only increments the balance when that insert actually happened, so
    // concurrent or replayed verifications cannot double-credit the wallet.
    const { data: balance, error: creditErr } = await (
      supabaseAdmin.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: number | null; error: { message: string } | null }>
    )("credit_wallet_topup", {
      _user_id: context.userId,
      _amount: amountInr,
      _ref: `Razorpay ${data.razorpay_payment_id}`,
    });
    if (creditErr) {
      console.error("Wallet credit failed", creditErr.message);
      throw new Error("Failed to credit wallet");
    }

    return {
      verified: true as const,
      balance: Number(balance ?? 0),
      amount_inr: amountInr,
    };
  });

