import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only server functions: AI assistant, AI reports, supplier health
 * checks and the auto-pricing runner.
 *
 * Every handler re-verifies the caller's admin role against `user_roles`
 * using the request-scoped (RLS-bound) client before touching privileged
 * data. Secrets are read inside handlers only.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

type Ctx = { supabase: any; userId: string };

/** Throws unless the caller holds the admin role. */
async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/** Calls the Lovable AI gateway and returns the assistant text. */
async function callAi(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached — please try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted — add credits in workspace settings.");
  if (!res.ok) {
    console.error("AI gateway error", res.status, await res.text().catch(() => ""));
    throw new Error("AI service error");
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

/* ------------------------------------------------------------------ */
/* Business snapshot                                                    */
/* ------------------------------------------------------------------ */

/**
 * Builds a compact, token-efficient snapshot of the business that the AI can
 * reason over: orders, revenue, profit, catalog margins, suppliers, customers.
 */
async function buildSnapshot(supabase: any) {
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

  const [orders, catalog, suppliers, profiles, tickets] = await Promise.all([
    supabase
      .from("orders")
      .select("order_code,product_slug,product_name,tier_label,amount_inr,currency,status,created_at,completed_at,user_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("catalog_products").select("product_slug,tier_label,category,price_inr,supplier_cost_inr,visible,stock_status,featured"),
    supabase.from("suppliers").select("name,status,priority,error_count,avg_response_ms,last_checked_at,auto_pricing_enabled,wallet_balance_inr"),
    supabase.from("profiles").select("id,created_at,wallet_balance"),
    supabase.from("support_tickets").select("status,priority,subject,created_at").limit(100),
  ]);

  const rows = (orders.data ?? []) as Array<Record<string, any>>;
  const products = (catalog.data ?? []) as Array<Record<string, any>>;
  const costBySku = new Map(products.map((p) => [`${p.product_slug}|${p.tier_label}`, Number(p.supplier_cost_inr) || 0]));

  const done = rows.filter((o) => ["completed", "delivered"].includes(o.status));
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const day = startOfDay.getTime();
  const week = day - 6 * 86400000;
  const month = day - 29 * 86400000;

  const sum = (list: Array<Record<string, any>>) => list.reduce((s, o) => s + (Number(o.amount_inr) || 0), 0);
  const profitOf = (o: Record<string, any>) =>
    (Number(o.amount_inr) || 0) - (costBySku.get(`${o.product_slug}|${o.tier_label}`) ?? 0);
  const at = (o: Record<string, any>) => new Date(o.completed_at ?? o.created_at).getTime();

  const todayOrders = done.filter((o) => at(o) >= day);
  const weekOrders = done.filter((o) => at(o) >= week);
  const monthOrders = done.filter((o) => at(o) >= month);

  const byProduct = new Map<string, { units: number; revenue: number; profit: number }>();
  for (const o of done) {
    const k = `${o.product_name} — ${o.tier_label}`;
    const e = byProduct.get(k) ?? { units: 0, revenue: 0, profit: 0 };
    e.units += 1;
    e.revenue += Number(o.amount_inr) || 0;
    e.profit += profitOf(o);
    byProduct.set(k, e);
  }
  const ranked = [...byProduct.entries()].map(([sku, v]) => ({ sku, ...v }));

  return {
    generated_at: new Date().toISOString(),
    revenue: {
      today: sum(todayOrders),
      last_7_days: sum(weekOrders),
      last_30_days: sum(monthOrders),
    },
    profit: {
      today: todayOrders.reduce((s, o) => s + profitOf(o), 0),
      last_7_days: weekOrders.reduce((s, o) => s + profitOf(o), 0),
      last_30_days: monthOrders.reduce((s, o) => s + profitOf(o), 0),
    },
    orders: {
      total_90d: rows.length,
      today: rows.filter((o) => new Date(o.created_at).getTime() >= day).length,
      pending: rows.filter((o) => o.status.startsWith("pending") || o.status === "awaiting_verification").length,
      completed: done.length,
      cancelled: rows.filter((o) => ["cancelled", "rejected", "failed", "expired"].includes(o.status)).length,
      average_order_value: done.length ? Math.round(sum(done) / done.length) : 0,
    },
    top_selling: ranked.sort((a, b) => b.units - a.units).slice(0, 10),
    most_profitable: ranked.sort((a, b) => b.profit - a.profit).slice(0, 10),
    low_margin_products: products
      .filter((p) => Number(p.supplier_cost_inr) > 0 && Number(p.price_inr) - Number(p.supplier_cost_inr) < 5)
      .slice(0, 20)
      .map((p) => ({
        sku: `${p.product_slug} — ${p.tier_label}`,
        price: Number(p.price_inr),
        cost: Number(p.supplier_cost_inr),
        profit: Number(p.price_inr) - Number(p.supplier_cost_inr),
      })),
    catalog_size: products.length,
    suppliers: suppliers.data ?? [],
    customers: {
      total: (profiles.data ?? []).length,
      new_last_30_days: (profiles.data ?? []).filter(
        (p: any) => new Date(p.created_at).getTime() >= month,
      ).length,
      total_wallet_balance: (profiles.data ?? []).reduce((s: number, p: any) => s + (Number(p.wallet_balance) || 0), 0),
    },
    open_tickets: (tickets.data ?? []).filter((t: any) => t.status === "open").length,
  };
}

const SYSTEM_PROMPT = `You are the Fatui Market AI Operations Analyst — an assistant for the store owner (admin) of an Indian game top-up reseller.

You are given a JSON snapshot of live business data. Use ONLY that data plus the admin's question.
Capabilities you should apply when relevant:
- answer questions about orders, revenue, products, customers and profit
- analyse sales trends and explain what changed and why it might have changed
- recommend pricing strategy (never suggest selling below supplier cost)
- flag unusual activity (sudden order spikes, refund clusters, negative margins)
- generate concise reports
- recommend which products to promote
- explain profit margins in plain language
- detect supplier issues (offline, slow, high error counts, stale checks)
- suggest concrete business improvements

Rules:
- All money is Indian Rupees (₹).
- If the snapshot lacks the data needed, say exactly what is missing instead of guessing.
- Never invent numbers. Quote figures from the snapshot.
- Be concise and use markdown: short paragraphs, bullet points, small tables.`;

/* ------------------------------------------------------------------ */
/* AI admin assistant                                                   */
/* ------------------------------------------------------------------ */

export const askAdminAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1).max(4000),
          }),
        )
        .min(1)
        .max(40),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const snapshot = await buildSnapshot(context.supabase);

    const reply = await callAi([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `LIVE BUSINESS SNAPSHOT:\n${JSON.stringify(snapshot)}` },
      ...data.messages,
    ]);

    return { reply };
  });

/* ------------------------------------------------------------------ */
/* Daily AI report                                                      */
/* ------------------------------------------------------------------ */

export const generateAiReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as Ctx);
    const snapshot = await buildSnapshot(context.supabase);

    const content = await callAi([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `LIVE BUSINESS SNAPSHOT:\n${JSON.stringify(snapshot)}` },
      {
        role: "user",
        content: `Write today's operations report with these markdown sections, each short and specific:
## Sales Summary
## Profit Summary
## Recommended Prices
## Supplier Changes
## Products Needing Attention
## Best Opportunities
## Customer Insights`,
      },
    ]);

    const { data: row, error } = await context.supabase
      .from("ai_reports")
      .insert({ kind: "daily", content, metrics: snapshot })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("admin_notifications").insert({
      type: "ai_report",
      severity: "info",
      title: "Daily AI report ready",
      body: "A fresh operations report has been generated.",
    });

    return row;
  });

/* ------------------------------------------------------------------ */
/* Supplier health check                                                */
/* ------------------------------------------------------------------ */

/**
 * Performs a lightweight reachability check against a supplier's own API
 * endpoint (only when the admin has configured one). We never scrape or crawl
 * supplier storefronts — suppliers without an API stay on manual status.
 */
export const checkSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ supplier_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);

    const { data: supplier } = await context.supabase
      .from("suppliers")
      .select("id,name,api_endpoint,avg_response_ms,error_count")
      .eq("id", data.supplier_id)
      .maybeSingle();
    if (!supplier) throw new Error("Supplier not found");

    if (!supplier.api_endpoint) {
      return {
        status: "unknown" as const,
        message: "No API endpoint configured — this supplier is manual-only.",
      };
    }

    let status = "online";
    let responseMs: number | null = null;
    let errorMessage: string | null = null;

    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(supplier.api_endpoint, {
        method: "GET",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      clearTimeout(timer);
      responseMs = Date.now() - started;

      if (res.status === 401 || res.status === 403) status = "auth_error";
      else if (!res.ok) status = "api_error";
      else if (responseMs > 3000) status = "slow";
      if (!res.ok) errorMessage = `HTTP ${res.status}`;
    } catch (err) {
      responseMs = Date.now() - started;
      status = "offline";
      errorMessage = err instanceof Error ? err.message : "Request failed";
    }

    const prevAvg = Number(supplier.avg_response_ms) || responseMs || 0;
    const avg = Math.round((prevAvg + (responseMs ?? prevAvg)) / 2);
    const errorCount =
      status === "online" || status === "slow" ? Number(supplier.error_count) || 0 : (Number(supplier.error_count) || 0) + 1;

    await context.supabase
      .from("suppliers")
      .update({ status, last_checked_at: new Date().toISOString(), avg_response_ms: avg, error_count: errorCount })
      .eq("id", supplier.id);

    await context.supabase.from("supplier_checks").insert({
      supplier_id: supplier.id,
      status,
      response_ms: responseMs,
      error_message: errorMessage,
    });

    if (status !== "online" && status !== "slow") {
      await context.supabase.from("admin_notifications").insert({
        type: "supplier_offline",
        severity: "critical",
        title: `${supplier.name} is ${status.replace("_", " ")}`,
        body: errorMessage ?? "Supplier health check failed.",
        metadata: { supplier_id: supplier.id },
      });
    }

    return { status, responseMs, message: errorMessage };
  });

/* ------------------------------------------------------------------ */
/* Auto pricing runner                                                  */
/* ------------------------------------------------------------------ */

export const runAutoPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ dry_run: z.boolean().default(false) }).default({ dry_run: false }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { computePricing } = await import("@/lib/admin/pricing");

    const { data: settings } = await context.supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings) throw new Error("Settings not found");

    const rules = {
      min_profit_inr: Number(settings.min_profit_inr),
      max_profit_inr: Number(settings.max_profit_inr),
      min_profit_pct: Number(settings.min_profit_pct),
      max_profit_pct: Number(settings.max_profit_pct),
      price_rounding: settings.price_rounding as import("@/lib/admin/pricing").PriceRounding,
    };

    const { data: products } = await context.supabase
      .from("catalog_products")
      .select("*")
      .eq("auto_pricing", true);

    const changes: Array<{ id: string; sku: string; old_price: number; new_price: number; reason: string }> = [];

    for (const p of (products ?? []) as Array<Record<string, any>>) {
      const calc = computePricing(Number(p.supplier_cost_inr), Number(p.price_inr), rules);
      if (!calc.needsChange) continue;

      changes.push({
        id: p.id,
        sku: `${p.product_slug} — ${p.tier_label}`,
        old_price: calc.currentPrice,
        new_price: calc.recommendedPrice,
        reason: calc.reason,
      });

      if (data.dry_run || settings.auto_pricing_mode !== "auto") continue;

      await context.supabase.from("catalog_products").update({ price_inr: calc.recommendedPrice }).eq("id", p.id);
      await context.supabase.from("price_history").insert({
        catalog_product_id: p.id,
        supplier_id: p.supplier_id,
        old_price_inr: calc.currentPrice,
        new_price_inr: calc.recommendedPrice,
        supplier_cost_inr: calc.cost,
        profit_inr: calc.recommendedProfit,
        reason: "auto-pricing",
        ai_explanation: `${calc.reason} Recommended ₹${calc.recommendedPrice} keeps profit at ₹${calc.recommendedProfit.toFixed(2)} (${calc.recommendedProfitPct.toFixed(1)}%).`,
        changed_by: context.userId,
      });
      await context.supabase.from("admin_notifications").insert({
        type: "price_change",
        severity: "info",
        title: `Price updated: ${p.product_slug} — ${p.tier_label}`,
        body: `₹${calc.currentPrice} → ₹${calc.recommendedPrice}. ${calc.reason}`,
        metadata: { catalog_product_id: p.id },
      });
    }

    return { mode: settings.auto_pricing_mode, dry_run: data.dry_run, changes };
  });

/* ------------------------------------------------------------------ */
/* Alert fanout (email / telegram / discord)                            */
/* ------------------------------------------------------------------ */

export const sendAdminAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(2000),
      severity: z.enum(["info", "success", "warning", "critical"]).default("info"),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);

    const { data: settings } = await context.supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    const text = `[${data.severity.toUpperCase()}] ${data.title}\n${data.body}`;

    // Telegram
    if (settings?.telegram_alerts_enabled && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
      }).catch(() => undefined);
    }

    // Discord webhook
    if (settings?.discord_webhook_url) {
      await fetch(settings.discord_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      }).catch(() => undefined);
    }

    await context.supabase.from("admin_notifications").insert({
      type: "manual_alert",
      severity: data.severity,
      title: data.title,
      body: data.body,
    });

    return { ok: true };
  });
