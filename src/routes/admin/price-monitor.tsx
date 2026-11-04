import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Check, X, Save } from "lucide-react";
import { getPriceMonitor, reviewPriceChanges, savePricingSettings } from "@/lib/supplier-price-monitor.functions";
import { StatCard } from "@/components/admin/stat-card";

export const Route = createFileRoute("/admin/price-monitor")({
  head: () => ({
    meta: [
      { title: "Supplier Price Monitor — Fatui Market Admin" },
      { name: "description", content: "Review supplier price changes and proposed INR prices." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PriceMonitorPage,
});

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const usd = (n: number | null) => (n == null ? "—" : `$${Number(n).toFixed(4).replace(/0{1,2}$/, "")}`);
const inr = (n: number | null) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`);

function PriceMonitorPage() {
  const qc = useQueryClient();
  const load = useServerFn(getPriceMonitor);
  const review = useServerFn(reviewPriceChanges);
  const save = useServerFn(savePricingSettings);
  const { data, isLoading } = useQuery({ queryKey: ["price-monitor"], queryFn: () => load() });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [cfg, setCfg] = useState({ usd_inr_rate: 111.1111, markup_pct: 15, rounding_step: 10 as 1 | 5 | 10 });

  useEffect(() => {
    if (data?.settings) setCfg({
      usd_inr_rate: Number(data.settings.usd_inr_rate),
      markup_pct: Number(data.settings.markup_pct),
      rounding_step: Number(data.settings.rounding_step) as 1 | 5 | 10,
    });
  }, [data?.settings]);

  const rows = useMemo(() => (data?.changes ?? []).filter((c) => filter === "all" || c.status === "pending"), [data, filter]);
  const pending = (data?.changes ?? []).filter((c) => c.status === "pending");

  const act = useMutation({
    mutationFn: (v: { action: "approve" | "reject"; ids?: string[]; all?: boolean }) => review({ data: v }),
    onSuccess: (r, v) => {
      toast.success(`${r.count} change(s) ${v.action === "approve" ? "approved" : "rejected"}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["price-monitor"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const saveCfg = useMutation({
    mutationFn: () => save({ data: cfg }),
    onSuccess: (r) => { toast.success(`Saved — ${r.recomputed} pending proposal(s) recalculated`); qc.invalidateQueries({ queryKey: ["price-monitor"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const avgMargin = pending.length ? pending.reduce((a, c) => a + Number(c.expected_margin_pct), 0) / pending.length : 0;

  return (
    <div className="space-y-6">
      <div className="surface-card p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" /> Preview mode</div>
        <p className="mt-1 text-muted-foreground">
          Supplier price changes are detected during catalog sync and queued here. Customer prices only change when you approve. Automatic publishing is off.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending changes" value={pending.length.toString()} tone={pending.length ? "warn" : "good"} />
        <StatCard label="Avg expected margin" value={`${avgMargin.toFixed(1)}%`} />
        <StatCard label="Acquisition rate" value={`₹${cfg.usd_inr_rate}/USD`} />
        <StatCard label="Last sync" value={data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : "—"} />
      </div>

      <div className="surface-card grid gap-3 p-4 sm:grid-cols-4">
        <label className="text-xs">USD→INR acquisition rate
          <input type="number" step="0.0001" className={field} value={cfg.usd_inr_rate} onChange={(e) => setCfg({ ...cfg, usd_inr_rate: Number(e.target.value) })} />
        </label>
        <label className="text-xs">Markup %
          <input type="number" step="0.1" className={field} value={cfg.markup_pct} onChange={(e) => setCfg({ ...cfg, markup_pct: Number(e.target.value) })} />
        </label>
        <label className="text-xs">Round up to
          <select className={field} value={cfg.rounding_step} onChange={(e) => setCfg({ ...cfg, rounding_step: Number(e.target.value) as 1 | 5 | 10 })}>
            <option value={5}>₹5</option><option value={10}>₹10</option><option value={1}>₹1</option>
          </select>
        </label>
        <button onClick={() => saveCfg.mutate()} disabled={saveCfg.isPending} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold">
          <Save className="h-4 w-4" /> Save settings
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-lg border border-input bg-background px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as "pending" | "all")}>
          <option value="pending">Pending</option><option value="all">All history</option>
        </select>
        <button disabled={!pending.length || act.isPending} onClick={() => confirm(`Approve all ${pending.length} pending changes? Customer prices will update.`) && act.mutate({ action: "approve", all: true })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold"><Check className="h-4 w-4" /> Approve all</button>
        <button disabled={!selected.size || act.isPending} onClick={() => act.mutate({ action: "approve", ids: [...selected] })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold"><Check className="h-4 w-4" /> Approve selected ({selected.size})</button>
        <button disabled={!selected.size || act.isPending} onClick={() => act.mutate({ action: "reject", ids: [...selected] })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-destructive"><X className="h-4 w-4" /> Reject</button>
      </div>

      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>{["", "Product / package", "Old USD", "New USD", "Acquisition", "Current ₹", "Proposed ₹", "Profit", "Margin", "Detected", "Status"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && !rows.length && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">No supplier price changes detected yet.</td></tr>}
            {rows.map((c) => {
              const up = Number(c.new_supplier_price_usd) > Number(c.old_supplier_price_usd ?? 0);
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-2">{c.status === "pending" && <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />}</td>
                  <td className="p-2"><div className="font-medium">{c.product_name}</div><div className="text-xs text-muted-foreground">{c.service_name}</div></td>
                  <td className="p-2">{usd(c.old_supplier_price_usd)}</td>
                  <td className={`p-2 font-semibold ${up ? "text-destructive" : "text-success"}`}>{usd(c.new_supplier_price_usd)} {up ? "▲" : "▼"}</td>
                  <td className="p-2">{inr(c.acquisition_cost_inr)}</td>
                  <td className="p-2">{inr(c.current_sell_price_inr)}</td>
                  <td className="p-2 font-semibold">{inr(c.proposed_sell_price_inr)}</td>
                  <td className="p-2">{inr(c.expected_profit_inr)}</td>
                  <td className="p-2">{Number(c.expected_margin_pct).toFixed(1)}%</td>
                  <td className="p-2 text-xs">{new Date(c.detected_at).toLocaleString()}</td>
                  <td className="p-2 text-xs capitalize">{c.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
