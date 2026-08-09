import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Search, Eye, EyeOff, Star, Plus, Trash2, Activity } from "lucide-react";
import {
  getCatalogOverview,
  runSupplierCatalogSync,
  refreshSupplierPrices,
  updateCatalogGame,
  listPricingRules,
  savePricingRule,
  deletePricingRule,
  getSupplierConnectivity,
} from "@/lib/flashtopup-catalog.functions";

export const Route = createFileRoute("/admin/catalog")({
  component: CatalogPage,
  errorComponent: () => (
    <div className="surface-card p-8 text-center text-sm text-muted-foreground">
      Could not load the supplier catalog. Please refresh.
    </div>
  ),
});

type Overview = Awaited<ReturnType<typeof getCatalogOverview>>;
type Rule = Awaited<ReturnType<typeof listPricingRules>>[number];

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const money = (v: number | null) => (typeof v === "number" ? `₹${v.toFixed(2)}` : "—");

function CatalogPage() {
  const loadOverview = useServerFn(getCatalogOverview);
  const loadRules = useServerFn(listPricingRules);
  const sync = useServerFn(runSupplierCatalogSync);
  const refreshPrices = useServerFn(refreshSupplierPrices);
  const updateGame = useServerFn(updateCatalogGame);
  const saveRule = useServerFn(savePricingRule);
  const removeRule = useServerFn(deletePricingRule);
  const checkConnection = useServerFn(getSupplierConnectivity);

  const [data, setData] = useState<Overview | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [diag, setDiag] = useState<Awaited<ReturnType<typeof getSupplierConnectivity>> | null>(null);
  const [draft, setDraft] = useState({
    scope: "global" as "global" | "category" | "product",
    scope_value: "",
    markup_type: "percent" as "percent" | "fixed",
    markup_value: 10,
    priority: 0,
  });

  const load = async () => {
    try {
      const [o, r] = await Promise.all([loadOverview({}), loadRules({})]);
      setData(o);
      setRules(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load catalog");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data?.games ?? [];
    return (data?.games ?? []).filter((g: any) =>
      [g.name, g.display_name, g.region, g.category, g.product_code].some((v: string | null) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [data, query]);

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const lastRun = data?.runs?.[0];

  return (
    <div className="space-y-6">
      <header className="surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">API Catalog</h1>
            <p className="text-sm text-muted-foreground">
              FlashTopup is the source of truth for games, packages and prices.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-shine rounded-xl bg-[var(--neon)]/15 px-4 py-2 text-sm font-semibold"
              disabled={busy !== null}
              onClick={() => run("sync", () => sync({}), "Catalog synced")}
            >
              <RefreshCw className={`mr-2 inline h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />
              Sync now
            </button>
            <button
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
              disabled={busy !== null}
              onClick={() => run("prices", () => refreshPrices({}), "Prices and stock refreshed")}
            >
              Refresh prices & stock
            </button>
            <button
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("diag");
                try {
                  setDiag(await checkConnection({}));
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Activity className="mr-2 inline h-4 w-4" />
              Test connection
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Games", data?.totals.games ?? 0],
            ["Live", data?.totals.active ?? 0],
            ["Unavailable", data?.totals.unavailable ?? 0],
            ["Packages", data?.totals.packages ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-lg font-bold">{value as number}</p>
            </div>
          ))}
        </div>

        {lastRun && (
          <p className="mt-3 text-xs text-muted-foreground">
            Last sync {new Date(lastRun.started_at).toLocaleString()} · {lastRun.status} ·{" "}
            {lastRun.products_total} games ({lastRun.products_added} new, {lastRun.products_disabled} disabled),{" "}
            {lastRun.services_total} packages
            {lastRun.error ? ` · ${lastRun.error}` : ""}
          </p>
        )}

        {diag && (
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-background/60 p-3 font-mono text-[11px]">
            {JSON.stringify(diag, null, 2)}
          </pre>
        )}
      </header>

      {/* Markup rules */}
      <section className="surface-card p-5">
        <h2 className="text-lg font-bold">Markup rules</h2>
        <p className="text-sm text-muted-foreground">
          Selling price = supplier price + markup. Product rules beat category rules, which beat the global rule.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-[130px_1fr_120px_120px_100px_auto]">
          <select
            className={field}
            value={draft.scope}
            onChange={(e) => setDraft({ ...draft, scope: e.target.value as typeof draft.scope })}
          >
            <option value="global">Global</option>
            <option value="category">Category</option>
            <option value="product">Product</option>
          </select>
          <input
            className={field}
            placeholder={draft.scope === "product" ? "Game ID" : draft.scope === "category" ? "Category name" : "—"}
            value={draft.scope_value}
            disabled={draft.scope === "global"}
            onChange={(e) => setDraft({ ...draft, scope_value: e.target.value })}
          />
          <select
            className={field}
            value={draft.markup_type}
            onChange={(e) => setDraft({ ...draft, markup_type: e.target.value as typeof draft.markup_type })}
          >
            <option value="percent">Percent %</option>
            <option value="fixed">Fixed ₹</option>
          </select>
          <input
            className={field}
            type="number"
            value={draft.markup_value}
            onChange={(e) => setDraft({ ...draft, markup_value: Number(e.target.value) })}
          />
          <input
            className={field}
            type="number"
            placeholder="Priority"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
          />
          <button
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            onClick={() =>
              run(
                "rule",
                () =>
                  saveRule({
                    data: {
                      id: null,
                      scope: draft.scope,
                      scope_value: draft.scope === "global" ? null : draft.scope_value.trim() || null,
                      markup_type: draft.markup_type,
                      markup_value: draft.markup_value,
                      priority: draft.priority,
                      active: true,
                    },
                  }),
                "Rule saved — prices recalculated",
              )
            }
          >
            <Plus className="mr-1 inline h-4 w-4" />
            Add
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span>
                <span className="font-semibold capitalize">{r.scope}</span>
                {r.scope_value ? ` · ${r.scope_value}` : ""} ·{" "}
                {r.markup_type === "percent" ? `+${r.markup_value}%` : `+₹${r.markup_value}`} · priority {r.priority}
              </span>
              <button
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete rule"
                onClick={() => run("rule", () => removeRule({ data: { id: r.id } }), "Rule deleted")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {!rules.length && <li className="text-sm text-muted-foreground">No rules yet — supplier price is used as-is.</li>}
        </ul>
      </section>

      {/* Games */}
      <section className="surface-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            className={field}
            placeholder="Search games, regions, categories or supplier codes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Game</th>
                <th className="px-2 py-2">Region</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Packages</th>
                <th className="px-2 py-2">Cost / Price</th>
                <th className="px-2 py-2">Supplier code</th>
                <th className="px-2 py-2 text-right">Controls</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g: any) => (
                <tr key={g.id} className="border-t border-border/60">
                  <td className="px-2 py-2 font-semibold">
                    {g.display_name || g.name}
                    {!g.active && <span className="ml-2 text-xs text-muted-foreground">(removed upstream)</span>}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{g.region ?? "—"}</td>
                  <td className="px-2 py-2 text-muted-foreground">{g.category ?? "—"}</td>
                  <td className="px-2 py-2">
                    {g.availablePackages}/{g.packages}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {money(g.fromCost)} → <span className="text-foreground">{money(g.fromPrice)}</span>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{g.product_code}</td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button
                        className={`rounded-lg border px-2 py-1 text-xs ${g.featured ? "border-[var(--neon)]/60 text-foreground" : "border-border text-muted-foreground"}`}
                        onClick={() => run(g.id, () => updateGame({ data: { id: g.id, featured: !g.featured } }), "Updated")}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className={`rounded-lg border px-2 py-1 text-xs ${g.hidden ? "border-destructive/60" : "border-border"}`}
                        onClick={() => run(g.id, () => updateGame({ data: { id: g.id, hidden: !g.hidden } }), "Updated")}
                      >
                        {g.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                        onClick={() => run(g.id, () => updateGame({ data: { id: g.id, enabled: !g.enabled } }), "Updated")}
                      >
                        {g.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!games.length && (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                    No games yet — run a sync to pull the supplier catalog.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
