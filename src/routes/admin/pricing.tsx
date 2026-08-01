import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Save, Wand2, CalendarClock, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/admin/stat-card";
import { computePricing, DEFAULT_RULES, inr, marginHealth, type PriceRounding, type PricingRules } from "@/lib/admin/pricing";

export const Route = createFileRoute("/admin/pricing")({
  head: () => ({
    meta: [
      { title: "Price Engine — Fatui Market Admin" },
      { name: "description", content: "Supplier cost, margins, recommended pricing, bulk edits and scheduled price changes." },
      { property: "og:title", content: "Price Engine — Fatui Market Admin" },
      { property: "og:description", content: "Smart pricing, margins and scheduled price changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

type Product = {
  id: string;
  product_slug: string;
  tier_label: string;
  name: string | null;
  price_inr: number;
  supplier_cost_inr: number;
  competitor_price_inr: number | null;
  min_safe_price_inr: number | null;
  auto_pricing: boolean;
};

type Schedule = {
  id: string;
  catalog_product_id: string;
  new_price_inr: number;
  apply_at: string;
  applied_at: string | null;
  status: string;
  note: string | null;
};

type HistoryRow = {
  id: string;
  catalog_product_id: string | null;
  old_price_inr: number | null;
  new_price_inr: number | null;
  supplier_cost_inr: number | null;
  profit_inr: number | null;
  reason: string | null;
  created_at: string;
};

const HEALTH_STYLE: Record<string, string> = {
  loss: "bg-destructive/15 text-destructive",
  low: "bg-warning/15 text-warning",
  healthy: "bg-success/15 text-success",
  high: "bg-blue-500/15 text-blue-400",
};

function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [rules, setRules] = useState<PricingRules>(DEFAULT_RULES);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Partial<Product>>>({});
  const [bulk, setBulk] = useState("5");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [p, s, h, cfg] = await Promise.all([
      supabase
        .from("catalog_products")
        .select("id,product_slug,tier_label,name,price_inr,supplier_cost_inr,competitor_price_inr,min_safe_price_inr,auto_pricing")
        .order("product_slug"),
      supabase.from("price_schedules").select("*").order("apply_at", { ascending: true }),
      supabase.from("price_history").select("id,catalog_product_id,old_price_inr,new_price_inr,supplier_cost_inr,profit_inr,reason,created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setSchedules((s.data ?? []) as Schedule[]);
    setHistory((h.data ?? []) as HistoryRow[]);
    if (cfg.data) {
      setRules({
        min_profit_inr: Number(cfg.data.min_profit_inr) || DEFAULT_RULES.min_profit_inr,
        max_profit_inr: Number(cfg.data.max_profit_inr) || DEFAULT_RULES.max_profit_inr,
        min_profit_pct: Number(cfg.data.min_profit_pct) || DEFAULT_RULES.min_profit_pct,
        max_profit_pct: Number(cfg.data.max_profit_pct) || DEFAULT_RULES.max_profit_pct,
        price_rounding: (cfg.data.price_rounding as PriceRounding) ?? DEFAULT_RULES.price_rounding,
      });
    }
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-pricing")
      .on("postgres_changes", { event: "*", schema: "public", table: "catalog_products" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "price_schedules" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "price_history" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  // Apply any scheduled change that is now due.
  useEffect(() => {
    const due = schedules.filter((s) => s.status === "scheduled" && new Date(s.apply_at) <= new Date());
    if (due.length === 0) return;
    void (async () => {
      for (const s of due) {
        await supabase.from("catalog_products").update({ price_inr: s.new_price_inr }).eq("id", s.catalog_product_id);
        await supabase.from("price_schedules").update({ status: "applied", applied_at: new Date().toISOString() }).eq("id", s.id);
        await supabase.from("price_history").insert({
          catalog_product_id: s.catalog_product_id,
          new_price_inr: s.new_price_inr,
          reason: "scheduled",
        });
      }
      void load();
    })();
  }, [schedules]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || `${p.name ?? ""} ${p.product_slug} ${p.tier_label}`.toLowerCase().includes(q))
      .map((p) => {
        const draft = drafts[p.id] ?? {};
        const price = Number(draft.price_inr ?? p.price_inr);
        const cost = Number(draft.supplier_cost_inr ?? p.supplier_cost_inr);
        const calc = computePricing(cost, price, rules);
        const minSafe = draft.min_safe_price_inr ?? p.min_safe_price_inr ?? Math.round(cost + rules.min_profit_inr);
        return { p, draft, price, cost, calc, minSafe: Number(minSafe) };
      });
  }, [products, drafts, query, rules]);

  const totals = useMemo(() => {
    const profit = rows.reduce((s, r) => s + r.calc.profit, 0);
    const avgPct = rows.length ? rows.reduce((s, r) => s + r.calc.profitPct, 0) / rows.length : 0;
    const flagged = rows.filter((r) => r.calc.needsChange).length;
    return { profit, avgPct, flagged };
  }, [rows]);

  const patch = (id: string, next: Partial<Product>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...next } }));

  const saveRow = async (id: string) => {
    const draft = drafts[id];
    const original = products.find((p) => p.id === id);
    if (!draft || !original) return;
    setSaving(true);
    const { error } = await supabase.from("catalog_products").update(draft).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (draft.price_inr !== undefined && Number(draft.price_inr) !== Number(original.price_inr)) {
      await supabase.from("price_history").insert({
        catalog_product_id: id,
        old_price_inr: original.price_inr,
        new_price_inr: Number(draft.price_inr),
        supplier_cost_inr: Number(draft.supplier_cost_inr ?? original.supplier_cost_inr),
        profit_inr: Number(draft.price_inr) - Number(draft.supplier_cost_inr ?? original.supplier_cost_inr),
        reason: "manual",
      });
    }
    setDrafts((d) => { const next = { ...d }; delete next[id]; return next; });
    toast.success("Price saved");
    void load();
  };

  const applyRecommended = (id: string) => {
    const row = rows.find((r) => r.p.id === id);
    if (!row) return;
    patch(id, { price_inr: row.calc.recommendedPrice });
  };

  const bulkApply = async (kind: "percent" | "recommended") => {
    const pct = Number(bulk) || 0;
    setSaving(true);
    for (const r of rows) {
      const next = kind === "recommended" ? r.calc.recommendedPrice : Math.round(r.price * (1 + pct / 100));
      if (next === r.price) continue;
      await supabase.from("catalog_products").update({ price_inr: next }).eq("id", r.p.id);
      await supabase.from("price_history").insert({
        catalog_product_id: r.p.id,
        old_price_inr: r.price,
        new_price_inr: next,
        supplier_cost_inr: r.cost,
        profit_inr: next - r.cost,
        reason: kind === "recommended" ? "bulk_recommended" : `bulk_${pct}%`,
      });
    }
    setSaving(false);
    setDrafts({});
    toast.success("Bulk update applied");
    void load();
  };

  const schedule = async (productId: string, price: number, when: string) => {
    const { error } = await supabase.from("price_schedules").insert({
      catalog_product_id: productId,
      new_price_inr: price,
      apply_at: new Date(when).toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Price change scheduled");
    void load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Price Engine</h2>
        <p className="text-xs text-muted-foreground">Live margins, recommendations and scheduling — saved to your database.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products priced" value={rows.length.toString()} />
        <StatCard label="Total profit per unit" value={inr(totals.profit)} tone="neon" />
        <StatCard label="Average margin" value={`${totals.avgPct.toFixed(1)}%`} tone={totals.avgPct < rules.min_profit_pct ? "warn" : "good"} />
        <StatCard label="Needs repricing" value={totals.flagged.toString()} tone={totals.flagged ? "warn" : "good"} />
      </div>

      <div className="surface-card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <input value={bulk} onChange={(e) => setBulk(e.target.value)} className="w-16 rounded-lg border border-input bg-background px-2 py-2 text-sm" />
          <span className="text-xs text-muted-foreground">%</span>
          <button disabled={saving} onClick={() => void bulkApply("percent")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">Bulk adjust</button>
          <button disabled={saving} onClick={() => void bulkApply("recommended")} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--neon)]/15 px-3 py-2 text-xs font-semibold text-[var(--neon)] disabled:opacity-50">
            <Wand2 className="h-3.5 w-3.5" /> Apply recommended
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Supplier cost</th>
              <th className="px-3 py-3">Selling price</th>
              <th className="px-3 py-3">Profit</th>
              <th className="px-3 py-3">Margin</th>
              <th className="px-3 py-3">Recommended</th>
              <th className="px-3 py-3">Min safe</th>
              <th className="px-3 py-3">Competitor</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, draft, price, cost, calc, minSafe }) => {
              const health = marginHealth(calc.profitPct, rules);
              const dirty = Object.keys(draft).length > 0;
              return (
                <tr key={p.id} className="border-t border-border align-middle">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{p.name ?? p.tier_label}</div>
                    <div className="text-[11px] text-muted-foreground">{p.product_slug} · {p.tier_label}</div>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={cost} onChange={(e) => patch(p.id, { supplier_cost_inr: Number(e.target.value) })} className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={price} onChange={(e) => patch(p.id, { price_inr: Number(e.target.value) })} className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" />
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{inr(calc.profit)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${HEALTH_STYLE[health]}`}>{calc.profitPct.toFixed(1)}%</span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => applyRecommended(p.id)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-secondary">
                      {inr(calc.recommendedPrice)}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={minSafe} onChange={(e) => patch(p.id, { min_safe_price_inr: Number(e.target.value) })} className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={draft.competitor_price_inr ?? p.competitor_price_inr ?? ""}
                      placeholder="—"
                      onChange={(e) => patch(p.id, { competitor_price_inr: e.target.value === "" ? null : Number(e.target.value) })}
                      className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button disabled={!dirty || saving} onClick={() => void saveRow(p.id)} className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-[11px] font-semibold text-success disabled:opacity-40">
                        <Save className="h-3 w-3" /> Save
                      </button>
                      <ScheduleButton onSchedule={(when) => void schedule(p.id, price, when)} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">No products found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><CalendarClock className="h-4 w-4" /> Scheduled changes</h3>
          <ul className="mt-3 divide-y divide-border text-sm">
            {schedules.map((s) => {
              const p = products.find((x) => x.id === s.catalog_product_id);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p?.name ?? p?.tier_label ?? "Product"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.apply_at).toLocaleString()} · {s.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{inr(Number(s.new_price_inr))}</span>
                    <button onClick={async () => { await supabase.from("price_schedules").delete().eq("id", s.id); void load(); }} className="rounded-md border border-border px-2 py-1 text-[11px]">Remove</button>
                  </div>
                </li>
              );
            })}
            {schedules.length === 0 && <li className="py-3 text-xs text-muted-foreground">No scheduled price changes.</li>}
          </ul>
        </div>

        <div className="surface-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground"><History className="h-4 w-4" /> Price history</h3>
          <ul className="mt-3 divide-y divide-border text-sm">
            {history.map((h) => {
              const p = products.find((x) => x.id === h.catalog_product_id);
              return (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p?.name ?? p?.tier_label ?? "Product"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()} · {h.reason ?? "—"}</div>
                  </div>
                  <div className="shrink-0 text-xs">
                    <span className="text-muted-foreground line-through">{h.old_price_inr != null ? inr(Number(h.old_price_inr)) : "—"}</span>{" "}
                    <span className="font-semibold">{h.new_price_inr != null ? inr(Number(h.new_price_inr)) : "—"}</span>
                  </div>
                </li>
              );
            })}
            {history.length === 0 && <li className="py-3 text-xs text-muted-foreground">No price changes recorded yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ScheduleButton({ onSchedule }: { onSchedule: (when: string) => void }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary">Schedule</button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-md border border-input bg-background px-1 py-1 text-[11px]" />
      <button
        onClick={() => { if (when) { onSchedule(when); setOpen(false); setWhen(""); } }}
        className="rounded-md bg-[var(--neon)]/15 px-2 py-1 text-[11px] font-semibold text-[var(--neon)]"
      >
        Set
      </button>
    </span>
  );
}
