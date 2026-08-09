import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Dynamic supplier catalog.
 *
 * Public functions read only the safe, customer-facing columns (never supplier
 * cost or raw supplier payloads). Admin functions re-verify the admin role.
 */

export type PublicGame = {
  id: string;
  slug: string | null;
  name: string;
  region: string | null;
  category: string | null;
  icon_url: string | null;
  featured: boolean;
  packages: number;
  available: boolean;
  from_price: number | null;
};

export type PublicPackage = {
  id: string;
  service_code: string;
  service_name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  min_quantity: number;
  max_quantity: number;
  available: boolean;
  requires_validation: boolean;
  input_fields: string[];
  /** Storefront product slug when this package is mapped to a store product. */
  checkout_slug: string | null;
};

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const displayName = (row: { display_name: string | null; name: string }) => row.display_name || row.name;

/** Server-side publishable client for anonymous catalog reads. */
async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Public: every enabled game with package counts and a "from" price. */
export const listPublicGames = createServerFn({ method: "GET" }).handler(async (): Promise<PublicGame[]> => {
  const supabase = await publicClient();

  const { data: games } = await supabase
    .from("supplier_products")
    .select("id, slug, name, display_name, region, category, icon_url, featured")
    .order("featured", { ascending: false })
    .order("name", { ascending: true });

  if (!games?.length) return [];

  const { data: services } = await supabase
    .from("supplier_services")
    .select("supplier_product_id, sell_price_inr, available")
    .in(
      "supplier_product_id",
      games.map((g: { id: string }) => g.id),
    );

  const byGame = new Map<string, { count: number; available: boolean; from: number | null }>();
  for (const s of services ?? []) {
    const entry = byGame.get(s.supplier_product_id) ?? { count: 0, available: false, from: null };
    entry.count += 1;
    if (s.available) entry.available = true;
    if (typeof s.sell_price_inr === "number" && (entry.from === null || s.sell_price_inr < entry.from)) {
      entry.from = s.sell_price_inr;
    }
    byGame.set(s.supplier_product_id, entry);
  }

  return games.map((g: any) => {
    const agg = byGame.get(g.id);
    return {
      id: g.id,
      slug: g.slug,
      name: displayName(g),
      region: g.region,
      category: g.category,
      icon_url: g.icon_url,
      featured: Boolean(g.featured),
      packages: agg?.count ?? 0,
      available: Boolean(agg?.available),
      from_price: agg?.from ?? null,
    };
  });
});

/** Public: one game plus its live packages. */
export const getPublicGame = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }): Promise<{ game: PublicGame; packages: PublicPackage[] } | null> => {
    const supabase = await publicClient();

    const { data: game } = await supabase
      .from("supplier_products")
      .select("id, slug, name, display_name, region, category, icon_url, featured")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!game) return null;

    const { data: services } = await supabase
      .from("supplier_services")
      .select(
        "id, service_code, service_name, description, sell_price_inr, currency, min_quantity, max_quantity, available, requires_validation, input_fields, sort_order",
      )
      .eq("supplier_product_id", game.id)
      .order("sort_order", { ascending: true });

    const mappedIds = [
      ...new Set((services ?? []).map((s: any) => s.catalog_product_id).filter(Boolean) as string[]),
    ];
    const slugById = new Map<string, string>();
    if (mappedIds.length) {
      const { data: mapped } = await supabase
        .from("catalog_products")
        .select("id, product_slug")
        .in("id", mappedIds);
      for (const m of mapped ?? []) slugById.set(m.id, m.product_slug);
    }

    const packages: PublicPackage[] = (services ?? []).map((s: any) => ({
      id: s.id,
      service_code: s.service_code,
      service_name: s.service_name,
      description: s.description,
      price: s.sell_price_inr,
      currency: s.currency ?? "INR",
      min_quantity: s.min_quantity,
      max_quantity: s.max_quantity,
      available: Boolean(s.available),
      requires_validation: Boolean(s.requires_validation),
      input_fields: toStringArray(s.input_fields),
      checkout_slug: s.catalog_product_id ? (slugById.get(s.catalog_product_id) ?? null) : null,
    }));

    return {
      game: {
        id: game.id,
        slug: game.slug,
        name: displayName(game as any),
        region: game.region,
        category: game.category,
        icon_url: game.icon_url,
        featured: Boolean(game.featured),
        packages: packages.length,
        available: packages.some((p) => p.available),
        from_price: packages.reduce<number | null>(
          (min, p) => (typeof p.price === "number" && (min === null || p.price < min) ? p.price : min),
          null,
        ),
      },
      packages,
    };
  });

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

export const getCatalogOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);

    const { data: games } = await context.supabase
      .from("supplier_products")
      .select("id, product_code, slug, name, display_name, region, category, icon_url, active, enabled, featured, hidden, validation_code, updated_at")
      .eq("supplier_key", "flashtopup")
      .order("name", { ascending: true });

    const { data: services } = await context.supabase
      .from("supplier_services")
      .select("supplier_product_id, supplier_price, sell_price_inr, available, active");

    const { data: runs } = await context.supabase
      .from("supplier_sync_runs")
      .select("id, kind, status, started_at, finished_at, products_total, products_added, products_updated, products_disabled, services_total, pages_fetched, error")
      .order("started_at", { ascending: false })
      .limit(5);

    const agg = new Map<string, { packages: number; available: number; cost: number | null; sell: number | null }>();
    for (const s of services ?? []) {
      const e = agg.get(s.supplier_product_id) ?? { packages: 0, available: 0, cost: null, sell: null };
      e.packages += 1;
      if (s.available && s.active) e.available += 1;
      if (typeof s.supplier_price === "number" && (e.cost === null || s.supplier_price < e.cost)) e.cost = s.supplier_price;
      if (typeof s.sell_price_inr === "number" && (e.sell === null || s.sell_price_inr < e.sell)) e.sell = s.sell_price_inr;
      agg.set(s.supplier_product_id, e);
    }

    const rows = (games ?? []).map((g: any) => {
      const a = agg.get(g.id);
      return {
        ...g,
        packages: a?.packages ?? 0,
        availablePackages: a?.available ?? 0,
        fromCost: a?.cost ?? null,
        fromPrice: a?.sell ?? null,
        profit: a && a.cost !== null && a.sell !== null ? Number((a.sell - a.cost).toFixed(2)) : null,
      };
    });

    return {
      games: rows,
      totals: {
        games: rows.length,
        active: rows.filter((r) => r.active && r.enabled && !r.hidden).length,
        unavailable: rows.filter((r) => r.packages > 0 && r.availablePackages === 0).length,
        packages: rows.reduce((n, r) => n + r.packages, 0),
      },
      runs: runs ?? [],
    };
  });

export const runSupplierCatalogSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runCatalogSync } = await import("./flashtopup-catalog.server");
    return runCatalogSync(supabaseAdmin);
  });

export const refreshSupplierPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshCatalogPrices } = await import("./flashtopup-catalog.server");
    return refreshCatalogPrices(supabaseAdmin);
  });

export const updateCatalogGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      enabled: z.boolean().optional(),
      featured: z.boolean().optional(),
      hidden: z.boolean().optional(),
      display_name: z.string().trim().max(120).nullable().optional(),
      category: z.string().trim().max(80).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("supplier_products").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPricingRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("pricing_rules")
      .select("id, scope, scope_value, markup_type, markup_value, priority, active, updated_at")
      .order("priority", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const savePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().nullable().optional(),
      scope: z.enum(["global", "category", "product"]),
      scope_value: z.string().trim().max(120).nullable(),
      markup_type: z.enum(["percent", "fixed"]),
      markup_value: z.number().min(-100).max(100000),
      priority: z.number().int().min(0).max(1000).default(0),
      active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { id, ...row } = data;
    const query = id
      ? context.supabase.from("pricing_rules").update(row).eq("id", id)
      : context.supabase.from("pricing_rules").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("pricing_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin diagnostics: which egress IP does the supplier see? */
export const getSupplierConnectivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./flashtopup-admin.server");
    await assertAdmin(context.supabase, context.userId);
    const { flashtopupRequestTraced } = await import("./flashtopup.server");
    const trace = await flashtopupRequestTraced("/products");
    let egressIp: string | null = null;
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      egressIp = ((await res.json()) as { ip?: string }).ip ?? null;
    } catch {
      /* diagnostics only */
    }
    return {
      ok: trace.ok,
      status: trace.status,
      egressIp,
      response: trace.rawResponse.slice(0, 800),
      error: trace.error,
      durationMs: trace.durationMs,
    };
  });
