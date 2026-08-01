import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS } from "@/lib/products";

export const Route = createFileRoute("/admin/servers")({
  component: ServersPage,
  errorComponent: () => (
    <div className="surface-card p-8 text-center text-sm text-muted-foreground">
      Could not load game servers. Please refresh.
    </div>
  ),
});

type Row = {
  id: string;
  product_slug: string;
  server_code: string;
  label: string;
  sort_order: number;
  active: boolean;
};

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

function ServersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState(PRODUCTS[0]?.slug ?? "");
  const [draft, setDraft] = useState({ server_code: "", label: "", sort_order: 0 });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("game_servers")
      .select("id,product_slug,server_code,label,sort_order,active")
      .order("product_slug", { ascending: true })
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const list = useMemo(() => rows.filter((r) => r.product_slug === slug), [rows, slug]);

  const add = async () => {
    const code = draft.server_code.trim().toLowerCase().replace(/\s+/g, "-");
    const label = draft.label.trim();
    if (!code || !label) return toast.error("Server code and label are required");
    const { error } = await supabase.from("game_servers").insert({
      product_slug: slug,
      server_code: code,
      label,
      sort_order: Number(draft.sort_order) || list.length + 1,
    });
    if (error) return toast.error(error.message);
    setDraft({ server_code: "", label: "", sort_order: 0 });
    toast.success("Server added");
    void load();
  };

  const patch = async (row: Row, changes: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...changes } : r)));
    const { error } = await supabase.from("game_servers").update(changes).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      void load();
    }
  };

  const remove = async (row: Row) => {
    const { error } = await supabase.from("game_servers").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Server removed");
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold">Game Servers</h2>
        <p className="text-sm text-muted-foreground">
          Edit the server / region dropdown shown to customers on each game page.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {PRODUCTS.map((p) => {
          const count = rows.filter((r) => r.product_slug === p.slug).length;
          return (
            <button
              key={p.slug}
              onClick={() => setSlug(p.slug)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                slug === p.slug
                  ? "border-[var(--neon)]/60 bg-[var(--neon)]/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.name} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">Loading servers…</div>
      )}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Label (shown to customer)</th>
                <th className="px-3 py-3">Code (saved on order)</th>
                <th className="px-3 py-3">Order</th>
                <th className="px-3 py-3">Active</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <input
                      className={field}
                      value={r.label}
                      onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))}
                      onBlur={(e) => patch(r, { label: e.target.value.trim() || r.label })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={field}
                      value={r.server_code}
                      onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, server_code: e.target.value } : x)))}
                      onBlur={(e) => patch(r, { server_code: e.target.value.trim().toLowerCase() || r.server_code })}
                    />
                  </td>
                  <td className="px-3 py-2 w-24">
                    <input
                      type="number"
                      className={field}
                      value={r.sort_order}
                      onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, sort_order: Number(e.target.value) } : x)))}
                      onBlur={(e) => patch(r, { sort_order: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => patch(r, { active: e.target.checked })}
                      className="h-4 w-4 accent-[var(--neon)]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => remove(r)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] text-destructive hover:bg-secondary"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No servers configured — this game will not show a server dropdown.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="surface-card mt-4 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add server</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
          <input className={field} placeholder="Label e.g. Asia" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
          <input className={field} placeholder="Code e.g. asia" value={draft.server_code} onChange={(e) => setDraft((d) => ({ ...d, server_code: e.target.value }))} />
          <input type="number" className={field} placeholder="Order" value={draft.sort_order} onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))} />
          <button
            onClick={add}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
