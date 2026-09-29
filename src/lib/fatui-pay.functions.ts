/**
 * Fatui Pay Verify — customer-facing payment server functions.
 *
 * - UTR/RRN submission is forwarded to Fatui Pay Verify with the API key read
 *   server-side only (FATUI_PAY_API_KEY). The key never reaches the browser.
 * - Checkout expiry is enforced here (server-side), not in the browser.
 * - Status refresh only ever reads the existing order — it can never create one.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildFatuiPayUtrPayload, normalizeUtr } from "@/lib/fatui-pay-submit";

/** Checkout window (matches the visible countdown). */
export const CHECKOUT_WINDOW_MS = 5 * 60 * 1000;
/** Bank/Gmail verification can land slightly after the window closes. */
export const VERIFY_GRACE_MS = 15 * 60 * 1000;

const FATUI_PAY_SUBMIT_URL = "https://fatui-pay-guardian.lovable.app/api/public/submit-utr";

export type OrderPaymentState = {
  order_code: string;
  status: string;
  payment_state:
    | "awaiting_payment"
    | "verifying"
    | "verified"
    | "rejected"
    | "duplicate_rrn"
    | "expired";
  amount: number;
  currency: string;
  utr: string | null;
  expires_at: string | null;
  seconds_left: number;
  can_pay: boolean;
  can_submit_utr: boolean;
  needs_review: boolean;
  reason: string | null;
  delivery_details: string | null;
  supplier_status: string | null;
};

type OrderRow = {
  id: string;
  order_code: string;
  status: string;
  utr: string | null;
  amount_inr: number | null;
  amount_usd: number | null;
  currency: string;
  expires_at: string | null;
  needs_review: boolean | null;
  reason: string | null;
  delivery_details: string | null;
  supplier_status: string | null;
  user_id: string | null;
  customer_email: string | null;
  customer_contact: string | null;
  player_name: string | null;
  product_name: string;
  tier_label: string;
  quantity: number;
};

const ORDER_COLUMNS =
  "id, order_code, status, utr, amount_inr, amount_usd, currency, expires_at, needs_review, reason, delivery_details, supplier_status, user_id, customer_email, customer_contact, player_name, product_name, tier_label, quantity";

export function paymentStateFor(status: string): OrderPaymentState["payment_state"] {
  switch (status) {
    case "pending_payment":
      return "awaiting_payment";
    case "pending_verification":
    case "awaiting_verification":
      return "verifying";
    case "paid":
    case "processing":
    case "completed":
    case "delivered":
      return "verified";
    case "duplicate_rrn":
      return "duplicate_rrn";
    case "expired":
    case "failed":
      return "expired";
    default:
      return "rejected";
  }
}

function amountOf(order: OrderRow) {
  return Number((order.currency === "INR" ? order.amount_inr : order.amount_usd) ?? 0);
}

function expiryMs(order: OrderRow) {
  return order.expires_at ? new Date(order.expires_at).getTime() : 0;
}

function toState(order: OrderRow): OrderPaymentState {
  const state = paymentStateFor(order.status);
  const left = Math.max(0, Math.floor((expiryMs(order) - Date.now()) / 1000));
  const withinGrace = Date.now() <= expiryMs(order) + VERIFY_GRACE_MS;
  return {
    order_code: order.order_code,
    status: order.status,
    payment_state: state,
    amount: amountOf(order),
    currency: order.currency,
    utr: order.utr,
    expires_at: order.expires_at,
    seconds_left: left,
    can_pay: state === "awaiting_payment" && left > 0,
    can_submit_utr: (state === "awaiting_payment" || state === "verifying") && withinGrace,
    needs_review: Boolean(order.needs_review),
    reason: order.reason,
    delivery_details: order.delivery_details,
    supplier_status: order.supplier_status,
  };
}

/** Marks a lapsed unpaid checkout as expired (server-side enforcement). */
async function enforceExpiry(order: OrderRow): Promise<OrderRow> {
  if (order.status !== "pending_payment") return order;
  const deadline = expiryMs(order);
  if (!deadline || Date.now() <= deadline + VERIFY_GRACE_MS) return order;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("orders")
    .update({
      status: "expired",
      expired_at: new Date().toISOString(),
      reason: "Checkout expired before payment was submitted",
    })
    .eq("id", order.id)
    .eq("status", "pending_payment");
  return { ...order, status: "expired", reason: "Checkout expired before payment was submitted" };
}

/** Read-only status refresh for the signed-in owner. Never creates an order. */
export const getOrderPaymentState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_code: string }) => {
    const code = String(input?.order_code ?? "").trim();
    if (!code) throw new Error("Order code is required");
    return { order_code: code };
  })
  .handler(async ({ data, context }): Promise<OrderPaymentState> => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("order_code", data.order_code)
      .maybeSingle();
    if (error) throw new Error("Could not load this order");
    if (!order) throw new Error("Order not found");
    return toState(await enforceExpiry(order as OrderRow));
  });

/**
 * Submits (or updates) the customer's UTR/RRN and forwards it to Fatui Pay
 * Verify. A verified/paid order can never have its UTR changed.
 */
export const submitOrderUtr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_code: string; utr: string }) => {
    const code = String(input?.order_code ?? "").trim();
    const utr = normalizeUtr(String(input?.utr ?? ""));
    if (!code) throw new Error("Order code is required");
    if (!/^[A-Za-z0-9]{6,32}$/.test(utr)) throw new Error("Enter a valid UTR / RRN (6–32 letters or digits)");
    return { order_code: code, utr };
  })
  .handler(async ({ data, context }): Promise<OrderPaymentState & { forwarded: boolean }> => {
    const { data: found, error } = await context.supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("order_code", data.order_code)
      .maybeSingle();
    if (error) throw new Error("Could not load this order");
    if (!found) throw new Error("Order not found");

    const order = await enforceExpiry(found as OrderRow);
    const state = paymentStateFor(order.status);

    if (state === "verified") throw new Error("This order is already paid — its reference cannot be changed");
    if (state === "duplicate_rrn") throw new Error("This payment reference was already used for another order");
    if (state === "expired" || Date.now() > expiryMs(order) + VERIFY_GRACE_MS) {
      throw new Error("This checkout has expired. Please place a new order.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // RRN uniqueness is enforced by the database; check early for a clear message.
    const { data: clash } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .ilike("utr", data.utr)
      .neq("id", order.id);
    if ((clash ?? []).some((o) => ["paid", "processing", "completed", "delivered"].includes(o.status))) {
      throw new Error("This payment reference has already been used for another order");
    }

    // Retain the normalized reference for a safe retry, but do not claim that
    // Fatui Pay accepted it until the provider returns a successful response.
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        utr: data.utr,
        needs_review: (clash ?? []).length > 0,
      })
      .eq("id", order.id);
    if (updateError) throw new Error("Could not save your payment reference");

    const apiKey = process.env["FATUI_PAY_API_KEY"];
    if (!apiKey) {
      console.error("[fatui-pay] submit-utr skipped: API key is not configured");
      throw new Error("Payment verification is temporarily unavailable. Your UTR was saved — please retry shortly.");
    }

    const { data: customer } = order.user_id
      ? await supabaseAdmin.from("profiles").select("display_name, contact").eq("id", order.user_id).maybeSingle()
      : { data: null };
    const payload = buildFatuiPayUtrPayload(order, customer, data.utr);

    let res: Response;
    try {
      res = await fetch(FATUI_PAY_SUBMIT_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("[fatui-pay] submit-utr request failed", {
        order_id: order.order_code,
        amount: payload.amount,
        message: err instanceof Error ? err.message : "network error",
      });
      throw new Error("Fatui Pay could not be reached. Your UTR was saved — please retry.");
    }

    if (!res.ok) {
      let providerMessage = "request rejected";
      try {
        const responseBody = await res.json() as { error?: string | { message?: string }; message?: string };
        providerMessage = typeof responseBody.error === "string"
          ? responseBody.error
          : responseBody.error?.message || responseBody.message || providerMessage;
      } catch {
        // Provider returned a non-JSON error; keep the generic safe message.
      }
      console.warn("[fatui-pay] submit-utr rejected", {
        order_id: order.order_code,
        amount: payload.amount,
        http_status: res.status,
        message: providerMessage,
      });
      throw new Error(`Fatui Pay rejected this submission (${res.status}). Your UTR was saved — please retry.`);
    }

    const submittedAt = new Date().toISOString();
    const { error: acceptedUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        utr: data.utr,
        utr_submitted_at: submittedAt,
        status: "pending_verification",
      })
      .eq("id", order.id);
    if (acceptedUpdateError) throw new Error("Fatui Pay accepted the UTR, but the order status could not be refreshed. Please check status shortly.");

    const refreshed: OrderRow = { ...order, utr: data.utr, status: "pending_verification" };
    return { ...toState(refreshed), forwarded: true };
  });
