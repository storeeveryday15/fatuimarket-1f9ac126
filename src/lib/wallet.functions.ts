import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MIN_TOPUP = 10;
const MAX_TOPUP = 100000;
const VERIFY_GRACE_MS = 15 * 60 * 1000;
const FATUI_PAY_SUBMIT_URL = "https://fatui-pay-guardian.lovable.app/api/public/submit-utr";

type WalletTopupRow = {
  id: string;
  topup_code: string;
  user_id: string;
  amount_inr: number;
  utr: string | null;
  status: string;
  reason: string | null;
  expires_at: string;
  created_at: string;
};

export type WalletTopupState = {
  topup_code: string;
  amount_inr: number;
  utr: string | null;
  status: string;
  reason: string | null;
  expires_at: string;
  seconds_left: number;
};

function stateFor(row: WalletTopupRow): WalletTopupState {
  return {
    topup_code: row.topup_code,
    amount_inr: Number(row.amount_inr),
    utr: row.utr,
    status: row.status,
    reason: row.reason,
    expires_at: row.expires_at,
    seconds_left: Math.max(0, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000)),
  };
}

async function loadTopup(code: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("wallet_topups")
    .select("id,topup_code,user_id,amount_inr,utr,status,reason,expires_at,created_at")
    .eq("topup_code", code)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not load this wallet top-up");
  if (!data) throw new Error("Wallet top-up not found");
  return data as WalletTopupRow;
}

export const createWalletTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ amount_inr: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const topupCode = `WLT-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const { data: row, error } = await supabaseAdmin
      .from("wallet_topups")
      .insert({ topup_code: topupCode, user_id: context.userId, amount_inr: data.amount_inr })
      .select("id,topup_code,user_id,amount_inr,utr,status,reason,expires_at,created_at")
      .single();
    if (error || !row) throw new Error("Could not start wallet top-up");
    return stateFor(row as WalletTopupRow);
  });

export const getWalletTopupState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ topup_code: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => stateFor(await loadTopup(data.topup_code, context.userId)));

export const submitWalletTopupUtr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    topup_code: z.string().min(1).max(64),
    utr: z.string().trim().regex(/^[A-Za-z0-9]{6,32}$/, "Enter a valid UTR / RRN"),
  }))
  .handler(async ({ data, context }) => {
    const topup = await loadTopup(data.topup_code, context.userId);
    if (topup.status === "paid") throw new Error("This wallet top-up is already credited");
    if (!["pending_payment", "pending_verification"].includes(topup.status)) {
      throw new Error("This wallet top-up is closed");
    }
    if (Date.now() > new Date(topup.expires_at).getTime() + VERIFY_GRACE_MS) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("wallet_topups").update({ status: "expired", reason: "Top-up expired" }).eq("id", topup.id);
      throw new Error("This wallet top-up has expired");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wallet_topups").update({
      utr: data.utr,
      utr_submitted_at: new Date().toISOString(),
      status: "pending_verification",
      reason: null,
    }).eq("id", topup.id);
    if (error) throw new Error("Could not save your payment reference");

    const apiKey = process.env["FATUI_PAY_API_KEY"];
    if (apiKey) {
      try {
        const response = await fetch(FATUI_PAY_SUBMIT_URL, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({
            order_code: topup.topup_code,
            amount: Number(topup.amount_inr),
            currency: "INR",
            utr: data.utr,
            purpose: "wallet_topup",
          }),
        });
        if (!response.ok) console.warn("[fatui-pay] wallet UTR forwarding rejected", { http_status: response.status });
      } catch (error) {
        console.error("[fatui-pay] wallet UTR forwarding failed", error instanceof Error ? error.message : "unknown error");
      }
    } else {
      console.error("[fatui-pay] wallet UTR forwarding skipped: API key is not configured");
    }

    return stateFor({ ...topup, utr: data.utr, status: "pending_verification", reason: null });
  });