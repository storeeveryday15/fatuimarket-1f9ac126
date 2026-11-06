import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only Supplier Price Monitor. Supplier costs and rates never leave admin paths. */

async function loadSettings(admin: any) {
  const { data } = await admin.from("supplier_pricing_settings").select("*").eq("id", 1).maybeSingle();
  const { DEFAULT_SUPPLIER_PRICING, DEFAULT_ALERT_THRESHOLDS } = await import("./supplier-pricing");
  return {
    pricing: data
      ? { usd_inr_rate: Number(data.usd_inr_rate), markup_pct: Number(data.markup_pct), rounding_step: Number(data.rounding_step) as 1 | 5 | 10 }
      : DEFAULT_SUPPLIER_PRICING,
    thresholds: data
      ? { min_change_pct: Number(data.min_change_pct), min_change_usd: Number(data.min_change_usd) }
      : DEFAULT_ALERT_THRESHOLDS,
    autoApply: Boolean(data?.auto_apply_enabled),
  };
}

async function adminCtx(context: { supabase: any; userId: string }) {
  const { assertAdmin } = await import("./flashtopup-admin.server");
  await assertAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const getPriceMonitor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminCtx(context);
    const { fetchAllRows } = await import("./fetch-all-rows");
    const { tryProposeSellPrice } = await import("./supplier-pricing");
    const settings = await loadSettings(admin);

    const [changes, legacy, lastSync, history] = await Promise.all([
      admin.from("supplier_price_changes").select("*").eq("kind", "change").order("detected_at", { ascending: false }).limit(500),
      admin.from("supplier_price_changes").select("id", { count: "exact", head: true }).eq("kind", "legacy").eq("status", "pending"),
      admin.from("supplier_sync_runs").select("finished_at, started_at").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("supplier_price_history").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (changes.error) throw new Error(changes.error.message);

    const services = await fetchAllRows<any>(() =>
      admin
        .from("supplier_services")
        .select("id, service_name, service_code, supplier_price, currency, customer_price_inr, available, supplier_products!inner(name, display_name, product_type, active)")
        .eq("active", true)
        .order("id"),
    );
    const unpriced = [];
    let priced = 0;
    for (const s of services) {
      if (s.customer_price_inr != null) { priced++; continue; }
      const p = tryProposeSellPrice(s.supplier_price, settings.pricing);
      unpriced.push({
        id: s.id,
        product: s.supplier_products.display_name || s.supplier_products.name,
        product_type: s.supplier_products.product_type,
        service_name: s.service_name,
        supplier_usd: s.supplier_price,
        available: s.available,
        valid: Boolean(p) && (!s.currency || String(s.currency).toUpperCase() === "USD"),
        acquisition_inr: p?.acquisitionCostInr ?? null,
        proposed_inr: p?.proposedSellPriceInr ?? null,
        profit_inr: p?.expectedProfitInr ?? null,
        margin_pct: p?.expectedMarginPct ?? null,
      });
    }

    return {
      settings: { ...settings.pricing, ...settings.thresholds, auto_apply_enabled: settings.autoApply },
      changes: changes.data ?? [],
      legacyPending: legacy.count ?? 0,
      unpriced,
      pricedCount: priced,
      history: history.data ?? [],
      lastSyncAt: lastSync.data?.finished_at ?? lastSync.data?.started_at ?? null,
    };
  });

/** Sets the first customer price for unpriced packages, using server-side maths only. */
export const approveInitialPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ serviceIds: z.array(z.string().uuid()).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminCtx(context);
    const { proposeSellPrice } = await import("./supplier-pricing");
    const { checkInitialPricing } = await import("./supplier-price-decisions");
    const { pricing } = await loadSettings(admin);
    const { data: rows, error } = await admin
      .from("supplier_services")
      .select("id, service_code, supplier_price, currency, active, customer_price_inr, supplier_products!inner(supplier_key, product_code)")
      .in("id", data.serviceIds);
    if (error) throw new Error(error.message);
    const now = new Date().toISOString();
    let applied = 0;
    const skipped: string[] = [];
    for (const s of rows ?? []) {
      const check = checkInitialPricing(s);
      if (!check.ok) { skipped.push(`${s.service_code}: ${check.reason}`); continue; }
      const p = proposeSellPrice(Number(s.supplier_price), pricing);
      const { data: upd, error: upErr } = await admin
        .from("supplier_services")
        .update({
          customer_price_inr: p.proposedSellPriceInr,
          priced_at_supplier_usd: Number(s.supplier_price),
          customer_price_approved_at: now,
          customer_price_approved_by: context.userId,
        })
        .eq("id", s.id)
        .is("customer_price_inr", null)
        .select("id");
      if (upErr || !upd?.length) { skipped.push(`${s.service_code}: not updated`); continue; }
      await admin.from("supplier_price_history").insert({
        supplier_service_id: s.id,
        supplier_key: s.supplier_products.supplier_key,
        product_code: s.supplier_products.product_code,
        service_code: s.service_code,
        action: "initial_price",
        old_supplier_usd: null,
        new_supplier_usd: Number(s.supplier_price),
        usd_inr_rate: pricing.usd_inr_rate,
        markup_pct: pricing.markup_pct,
        rounding_step: pricing.rounding_step,
        old_customer_price_inr: null,
        new_customer_price_inr: p.proposedSellPriceInr,
        actor_id: context.userId,
      });
      applied++;
    }
    return { applied, skipped };
  });

export const reviewPriceChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ action: z.enum(["approve", "reject"]), ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await adminCtx(context);
    const { proposeSellPrice } = await import("./supplier-pricing");
    const { checkChangeApproval } = await import("./supplier-price-decisions");
    const { pricing } = await loadSettings(admin);

    let q = admin.from("supplier_price_changes").select("*").eq("status", "pending").eq("kind", "change");
    if (!data.all) {
      if (!data.ids?.length) return { count: 0, skipped: [] as string[] };
      q = q.in("id", data.ids);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const now = new Date().toISOString();
    let count = 0;
    const skipped: string[] = [];

    for (const c of rows ?? []) {
      const { data: svc } = await admin
        .from("supplier_services")
        .select("id, active, customer_price_inr, supplier_price, priced_at_supplier_usd")
        .eq("id", c.supplier_service_id)
        .maybeSingle();
      const historyBase = {
        supplier_service_id: c.supplier_service_id,
        supplier_key: c.supplier_key,
        service_code: c.service_code,
        old_supplier_usd: c.baseline_supplier_usd,
        new_supplier_usd: c.new_supplier_price_usd,
        usd_inr_rate: pricing.usd_inr_rate,
        markup_pct: pricing.markup_pct,
        rounding_step: pricing.rounding_step,
        old_customer_price_inr: svc?.customer_price_inr ?? null,
        price_change_id: c.id,
        source_sync_run_id: c.source_sync_run_id,
        actor_id: context.userId,
      };

      if (data.action === "reject") {
        await admin.from("supplier_price_changes").update({ status: "rejected", reviewed_at: now, reviewed_by: context.userId }).eq("id", c.id);
        await admin.from("supplier_price_history").insert({ ...historyBase, action: "price_change_rejected", new_customer_price_inr: svc?.customer_price_inr ?? null });
        count++;
        continue;
      }

      const check = checkChangeApproval(c, svc);
      if (!check.ok) { skipped.push(`${c.service_code}: ${check.reason}`); continue; }
      const p = proposeSellPrice(Number(c.new_supplier_price_usd), pricing);
      const { data: upd, error: upErr } = await admin
        .from("supplier_services")
        .update({
          customer_price_inr: p.proposedSellPriceInr,
          priced_at_supplier_usd: Number(c.new_supplier_price_usd),
          customer_price_approved_at: now,
          customer_price_approved_by: context.userId,
        })
        .eq("id", c.supplier_service_id)
        .eq("customer_price_inr", svc!.customer_price_inr)
        .select("id");
      if (upErr || !upd?.length) { skipped.push(`${c.service_code}: not updated`); continue; }
      await admin.from("supplier_price_changes").update({
        status: "approved", reviewed_at: now, reviewed_by: context.userId, applied_customer_price_inr: p.proposedSellPriceInr,
      }).eq("id", c.id);
      await admin.from("supplier_price_history").insert({ ...historyBase, action: "price_change_approved", new_customer_price_inr: p.proposedSellPriceInr });
      count++;
    }
    return { count, skipped };
  });

/** Legacy alerts were computed from unconverted USD values; they can only be rejected. */
export const rejectLegacyAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminCtx(context);
    const { count, error } = await admin
      .from("supplier_price_changes")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: context.userId }, { count: "exact" })
      .eq("kind", "legacy")
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const savePricingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      usd_inr_rate: z.number().positive().max(1000),
      markup_pct: z.number().min(0).max(500),
      rounding_step: z.union([z.literal(1), z.literal(5), z.literal(10)]),
      min_change_pct: z.number().min(0).max(100),
      min_change_usd: z.number().min(0).max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await adminCtx(context);
    const { proposeSellPrice, validatePricingSettings } = await import("./supplier-pricing");
    validatePricingSettings(data);
    // auto_apply_enabled stays false: automatic publishing requires separate approval.
    const { error } = await admin
      .from("supplier_pricing_settings")
      .upsert({ id: 1, ...data, auto_apply_enabled: false, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);

    const { data: pending } = await admin
      .from("supplier_price_changes").select("id, new_supplier_price_usd").eq("status", "pending").eq("kind", "change");
    for (const p of pending ?? []) {
      const r = proposeSellPrice(Number(p.new_supplier_price_usd), data);
      await admin.from("supplier_price_changes").update({
        usd_inr_rate: data.usd_inr_rate, markup_pct: data.markup_pct, rounding_step: data.rounding_step,
        acquisition_cost_inr: r.acquisitionCostInr, proposed_sell_price_inr: r.proposedSellPriceInr,
        expected_profit_inr: r.expectedProfitInr, expected_margin_pct: r.expectedMarginPct,
      }).eq("id", p.id);
    }
    return { recomputed: pending?.length ?? 0 };
  });
