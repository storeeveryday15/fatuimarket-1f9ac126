import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Check, X, Save } from "lucide-react";
import {
  approveInitialPrices,
  getPriceMonitor,
  reviewPriceChanges,
  savePricingSettings,
} from "@/lib/supplier-price-monitor.functions";
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
const btn = "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50";
const usd = (n: number | null | undefined) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);
const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`);
type Tab = "changes" | "unpriced" | "history";

function PriceMonitorPage() {
  const qc = useQueryClient();
  const load = useServerFn(getPriceMonitor);
  const review = useServerFn(reviewPriceChanges);
  const initial = useServerFn(approveInitialPrices);
  const save = useServerFn(savePricingSettings);
  const { data, isLoading } = useQuery({ queryKey: ["price-monitor"], queryFn: () => load() });
  const [tab, setTab] = useState<Tab>("changes");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [cfg, setCfg] = useState({ usd_inr_rate: 111.1111, markup_pct: 15, rounding_step: 10 as 1 | 5 | 10, min_change_pct: 1, min_change_usd: 0.01 });

  useEffect(() => {
    if (data?.settings) setCfg({
      usd_inr_rate: Number(data.settings.usd_inr_rate),
      markup_pct: Number(data.settings.markup_pct),
      rounding_step: Number(data.settings.rounding_step) as 1 | 5 | 10,
      min_change_pct: Number(data.settings.min_change_pct),
      min_change_usd: Number(data.settings.min_change_usd),
    });
  }, [data?.settings]);

  useEffect(() => setSelected(new Set()), [tab]);
  const refresh = () => { setSelected(new Set()); qc.invalidateQueries({ queryKey: ["price-monitor"] }); };
  const report = (n: number, verb: string, skipped: string[]) => {
    toast.success(`${n} ${verb}`);
    if (skipped.length) toast.warning(`${skipped.length} skipped: ${skipped.slice(0, 3).join("; ")}`);
  };

  const act = useMutation({
    mutationFn: (v: { action: "approve" | "reject"; ids: string[] }) => review({ data: v }),
    onSuccess: (r, v) => { report(r.count, v.action === "approve" ? "approved" : "rejected", r.skipped); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const setInitial = useMutation({
    mutationFn: (ids: string[]) => initial({ data: { serviceIds: ids } }),
    onSuccess: (r) => { report(r.applied, "package price(s) set", r.skipped); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const saveCfg = useMutation({
    mutationFn: () => save({ data: cfg }),
    onSuccess: (r) => { toast.success(`Saved — ${r.recomputed} pending alert(s) recalculated`); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const pending = (data?.changes ?? []).filter((c: any) => c.status === "pending");
  const q = search.trim().toLowerCase();
  const unpriced = useMemo(
    () => (data?.unpriced ?? []).filter((u) => !q || `${u.product} ${u.service_name}`.toLowerCase().includes(q)).slice(0, 300),
    [data, q],
  );
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-6">
      <div className="surface-card p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" /> Preview mode — automatic pricing is off</div>
        <p className="mt-1 text-muted-foreground">
          Customer prices only change when you approve them here. Packages without an approved price are not purchasable.
          {data?.legacyPending ? ` ${data.legacyPending.toLocaleString()} old alerts were calculated from unconverted USD values and are hidden; they cannot be approved.` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending price changes" value={pending.length.toString()} tone={pending.length ? "warn" : "good"} />
        <StatCard label="Priced packages" value={(data?.pricedCount ?? 0).toLocaleString()} />
        <StatCard label="Awaiting first price" value={(data?.unpriced.length ?? 0).toLocaleString()} />
        <StatCard label="Last sync" value={data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : "—"} />
      </div>

      <div className="surface-card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs">USD→INR rate
          <input type="number" step="0.0001" className={field} value={cfg.usd_inr_rate} onChange={(e) => setCfg({ ...cfg, usd_inr_rate: Number(e.target.value) })} />
        </label>
        <label className="text-xs">Markup %
          <input type="number" step="0.1" className={field} value={cfg.markup_pct} onChange={(e) => setCfg({ ...cfg, markup_pct: Number(e.target.value) })} />
        </label>
        <label className="text-xs">Round up to
          <select className={field} value={cfg.rounding_step} onChange={(e) => setCfg({ ...cfg, rounding_step: Number(e.target.value) as 1 | 5 | 10 })}>
            <option value={10}>₹10</option><option value={5}>₹5</option><option value={1}>₹1</option>
          </select>
        </label>
        <label className="text-xs">Alert if change ≥ %
          <input type="number" step="0.1" className={field} value={cfg.min_change_pct} onChange={(e) => setCfg({ ...cfg, min_change_pct: Number(e.target.value) })} />
        </label>
        <label className="text-xs">and ≥ USD
          <input type="number" step="0.01" className={field} value={cfg.min_change_usd} onChange={(e) => setCfg({ ...cfg, min_change_usd: Number(e.target.value) })} />
        </label>
        <button onClick={() => saveCfg.mutate()} disabled={saveCfg.isPending} className={`${btn} mt-auto justify-center`}>
          <Save className="h-4 w-4" /> Save
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {([["changes", "Price changes"], ["unpriced", "Awaiting first price"], ["history", "History"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`${btn} ${tab === k ? "bg-accent" : ""}`}>{l}</button>
        ))}
      </div>

      {tab === "changes" && (
        <>
          <div className="flex flex-wrap gap-2">
            <button disabled={!selected.size || act.isPending} onClick={() => act.mutate({ action: "approve", ids: [...selected] })} className={btn}><Check className="h-4 w-4" /> Approve selected ({selected.size})</button>
            <button disabled={!selected.size || act.isPending} onClick={() => act.mutate({ action: "reject", ids: [...selected] })} className={`${btn} text-destructive`}><X className="h-4 w-4" /> Reject selected</button>
          </div>
          <Table head={["", "Product / package", "Approved at", "New cost", "Change", "Current ₹", "Proposed ₹", "Profit", "Margin", "Detected", "Status"]} loading={isLoading} empty="No meaningful supplier price changes on priced packages.">
            {(data?.changes ?? []).map((c: any) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2">{c.status === "pending" && <input type="checkbox" aria-label={`Select ${c.service_name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />}</td>
                <td className="p-2"><div className="font-medium">{c.product_name}</div><div className="text-xs text-muted-foreground">{c.service_name}</div></td>
                <td className="p-2">{usd(c.baseline_supplier_usd)}</td>
                <td className="p-2 font-semibold">{usd(c.new_supplier_price_usd)}</td>
                <td className={`p-2 ${Number(c.change_pct) > 0 ? "text-destructive" : "text-success"}`}>{Number(c.change_pct) > 0 ? "+" : ""}{Number(c.change_pct ?? 0).toFixed(2)}%</td>
                <td className="p-2">{inr(c.previous_customer_price_inr)}</td>
                <td className="p-2 font-semibold">{inr(c.proposed_sell_price_inr)}</td>
                <td className="p-2">{inr(c.expected_profit_inr)}</td>
                <td className="p-2">{Number(c.expected_margin_pct).toFixed(1)}%</td>
                <td className="p-2 text-xs">{new Date(c.detected_at).toLocaleString()}</td>
                <td className="p-2 text-xs capitalize">{c.status}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {tab === "unpriced" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${field} max-w-xs`} placeholder="Search game or package" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button disabled={!selected.size || setInitial.isPending} onClick={() => setInitial.mutate([...selected])} className={btn}><Check className="h-4 w-4" /> Set price for selected ({selected.size})</button>
            <span className="text-xs text-muted-foreground">Showing up to 300. Prices are recalculated on the server when approved.</span>
          </div>
          <Table head={["", "Product", "Package", "Supplier cost", "Acquisition", "Proposed ₹", "Profit", "Margin", "Stock"]} loading={isLoading} empty="Every active package has an approved price.">
            {unpriced.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-2">{u.valid && <input type="checkbox" aria-label={`Select ${u.service_name}`} checked={selected.has(u.id)} onChange={() => toggle(u.id)} />}</td>
                <td className="p-2"><div className="font-medium">{u.product}</div><div className="text-xs text-muted-foreground">{u.product_type}</div></td>
                <td className="p-2">{u.service_name}</td>
                <td className="p-2">{usd(u.supplier_usd)}</td>
                <td className="p-2">{inr(u.acquisition_inr)}</td>
                <td className="p-2 font-semibold">{u.valid ? inr(u.proposed_inr) : "Invalid cost"}</td>
                <td className="p-2">{inr(u.profit_inr)}</td>
                <td className="p-2">{u.margin_pct == null ? "—" : `${u.margin_pct.toFixed(1)}%`}</td>
                <td className="p-2 text-xs">{u.available ? "In stock" : "Out of stock"}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {tab === "history" && (
        <Table head={["When", "Package", "Action", "Cost", "Rate / markup", "Old ₹", "New ₹"]} loading={isLoading} empty="No price decisions recorded yet.">
          {(data?.history ?? []).map((h: any) => (
            <tr key={h.id} className="border-t border-border">
              <td className="p-2 text-xs">{new Date(h.created_at).toLocaleString()}</td>
              <td className="p-2 text-xs">{h.service_code}</td>
              <td className="p-2 text-xs">{h.action.replace(/_/g, " ")}</td>
              <td className="p-2">{usd(h.old_supplier_usd)} → {usd(h.new_supplier_usd)}</td>
              <td className="p-2 text-xs">₹{h.usd_inr_rate} · {h.markup_pct}% · ₹{h.rounding_step}</td>
              <td className="p-2">{inr(h.old_customer_price_inr)}</td>
              <td className="p-2 font-semibold">{inr(h.new_customer_price_inr)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function Table({ head, loading, empty, children }: { head: string[]; loading: boolean; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr>{head.map((h, i) => <th key={i} className="p-2">{h}</th>)}</tr></thead>
        <tbody>
          {loading && <tr><td colSpan={head.length} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
          {!loading && !children.length && <tr><td colSpan={head.length} className="p-6 text-center text-muted-foreground">{empty}</td></tr>}
          {children}
        </tbody>
      </table>
    </div>
  );
}
