import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only Supplier Price Monitor. Supplier costs and rates never leave admin paths. */

export const getPriceMonitor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const [settings, changes, lastSync] = await Promise.all([
      context.supabase.from("supplier_pricing_settings").select("*").eq("id", 1).maybeSingle(),
      context.supabase.from("supplier_price_changes").select("*").order("detected_at", { ascending: false }).limit(500),
      context.supabase.from("supplier_sync_runs").select("finished_at, started_at, status").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (changes.error) throw new Error(changes.error.message);
    return {
      settings: settings.data,
      changes: changes.data ?? [],
      lastSyncAt: lastSync.data?.finished_at ?? lastSync.data?.started_at ?? null,
    };
  });

export const reviewPriceChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ action: z.enum(["approve", "reject"]), ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase.from("supplier_price_changes").select("id, supplier_service_id, proposed_sell_price_inr").eq("status", "pending");
    if (!data.all) {
      if (!data.ids?.length) return { count: 0 };
      q = q.in("id", data.ids);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const r of rows ?? []) {
      if (data.action === "approve") {
        const { error: upErr } = await supabaseAdmin
          .from("supplier_services")
          .update({ sell_price_inr: r.proposed_sell_price_inr })
          .eq("id", r.supplier_service_id);
        if (upErr) throw new Error(upErr.message);
      }
      await context.supabase
        .from("supplier_price_changes")
        .update({ status: data.action === "approve" ? "approved" : "rejected", reviewed_at: now, reviewed_by: context.userId })
        .eq("id", r.id);
    }
    return { count: rows?.length ?? 0 };
  });

export const savePricingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      usd_inr_rate: z.number().positive().max(1000),
      markup_pct: z.number().min(0).max(500),
      rounding_step: z.union([z.literal(1), z.literal(5), z.literal(10)]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    // auto_apply_enabled stays false: automatic publishing requires separate approval.
    const { error } = await context.supabase
      .from("supplier_pricing_settings")
      .upsert({ id: 1, ...data, auto_apply_enabled: false, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);

    // Recompute pending proposals with the new settings.
    const { proposeSellPrice } = await import("./supplier-pricing");
    const { data: pending } = await context.supabase
      .from("supplier_price_changes").select("id, new_supplier_price_usd").eq("status", "pending");
    for (const p of pending ?? []) {
      const r = proposeSellPrice(Number(p.new_supplier_price_usd), data);
      await context.supabase.from("supplier_price_changes").update({
        usd_inr_rate: data.usd_inr_rate, markup_pct: data.markup_pct, rounding_step: data.rounding_step,
        acquisition_cost_inr: r.acquisitionCostInr, proposed_sell_price_inr: r.proposedSellPriceInr,
        expected_profit_inr: r.expectedProfitInr, expected_margin_pct: r.expectedMarginPct,
      }).eq("id", p.id);
    }
    return { recomputed: pending?.length ?? 0 };
  });
