import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-only Razorpay integration using the REST API (no SDK required).
// Secrets (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are read inside handlers.

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      amount: z.number().int().min(100), // paise, min 100 (₹1)
      currency: z.string().default("INR"),
      receipt: z.string().max(40).optional(),
      notes: z.record(z.string(), z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials are not configured");
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: data.amount,
        currency: data.currency,
        receipt: data.receipt,
        notes: data.notes,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Razorpay order creation failed (${res.status}): ${text}`);
    }

    const order = (await res.json()) as {
      id: string;
      amount: number;
      currency: string;
    };

    return {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      razorpay_order_id: z.string().min(1),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().min(1),
      order_code: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Razorpay secret is not configured");

    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(data.razorpay_signature, "hex");
    const valid = a.length === b.length && timingSafeEqual(a, b);

    if (!valid) {
      return { verified: false as const };
    }

    return {
      verified: true as const,
      payment_id: data.razorpay_payment_id,
      order_id: data.razorpay_order_id,
    };
  });
