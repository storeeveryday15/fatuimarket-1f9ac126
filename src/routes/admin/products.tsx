import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import type { CatalogProduct, Supplier } from "@/lib/admin/types";
import { computePricing, DEFAULT_RULES, inr } from "@/lib/admin/pricing";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/admin/products")({ component: ProductsPage });

const BLANK = { product_slug: "", tier_label: "", category: "", price_inr: 0, supplier_cost_inr: 0, supplier_id: "", visible: true, featured: false, stock_status: "in_stock", auto_pricing: false, image_url: "", description: "" };

function ProductsPage() {
  const { rows, loading } = useRealtimeTable<CatalogProduct>("catalog_products", { orderBy: "product_slug", ascending: true });
  const { rows: suppliers } = useRealtimeTable<Supplier>("suppliers", { orderBy: "priority", ascending: true });
  const [form, setForm] = useState({ ...BLANK });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const save = async () => {
    const payload = { ...form, supplier_id: form.supplier_id || null, category: form.category || null, image_url: form.image_url || null, description: form.description || null };
    if (!payload.product_slug || !payload.tier_label) return toast.error("Slug and tier are required");
    const { error } = editId
      ? await supabase.from("catalog_products").update(payload).eq("id", editId)
      : await supabase.from("catalog_products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
  };

  const patch = async (id: string, p: Partial<CatalogProduct>) => {
    const { error } = await supabase.from("catalog_products").update(p).eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Products</h2>
        <button onClick={() => { setForm({ ...BLANK }); setEditId(null); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add product</button>
      </div>

      {loading && <div className="surface-card p-10 text-center text-sm text-muted-foreground">Loading catalog…</div>}
      {!loading && (rows ?? []).length === 0 && (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">No catalog entries yet. Add your SKUs with supplier cost to unlock profit tracking and the price engine.</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Cost</th><th className="px-3 py-3">Price</th><th className="px-3 py-3">Profit</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3">Flags</th><th className="px-3 py-3">Actions</th></tr>
          </thead>
          <tbody>
            {(rows ?? []).map((p) => {
              const calc = computePricing(Number(p.supplier_cost_inr), Number(p.price_inr), DEFAULT_RULES);
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-3"><div className="font-semibold">{p.product_slug}</div><div className="text-xs text-muted-foreground">{p.tier_label}</div></td>
                  <td className="px-3 py-3">{inr(p.supplier_cost_inr)}</td>
                  <td className="px-3 py-3 font-semibold">{inr(p.price_inr)}</td>
                  <td className={`px-3 py-3 font-semibold ${calc.profit < 0 ? "text-destructive" : "text-success"}`}>{inr(calc.profit)}<div className="text-[11px] font-normal text-muted-foreground">{calc.profitPct.toFixed(1)}%</div></td>
                  <td className="px-3 py-3 text-xs">{p.stock_status.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3 text-xs">
                    <label className="mr-2"><input type="checkbox" checked={p.visible} onChange={(e) => patch(p.id, { visible: e.target.checked })} /> visible</label>
                    <label className="mr-2"><input type="checkbox" checked={p.featured} onChange={(e) => patch(p.id, { featured: e.target.checked })} /> featured</label>
                    <label><input type="checkbox" checked={p.auto_pricing} onChange={(e) => patch(p.id, { auto_pricing: e.target.checked })} /> auto</label>
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => { setForm({ product_slug: p.product_slug, tier_label: p.tier_label, category: p.category ?? "", price_inr: Number(p.price_inr), supplier_cost_inr: Number(p.supplier_cost_inr), supplier_id: p.supplier_id ?? "", visible: p.visible, featured: p.featured, stock_status: p.stock_status, auto_pricing: p.auto_pricing, image_url: p.image_url ?? "", description: p.description ?? "" }); setEditId(p.id); setOpen(true); }} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary">Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="flex-1 bg-black/50" />
          <div className="h-full w-full max-w-lg overflow-y-auto bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold">{editId ? "Edit product" : "New product"}</div>
            <div className="mt-4 grid gap-3 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-input [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-input [&_select]:bg-background [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-input [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-sm">
              <input placeholder="Product slug (e.g. mobile-legends)" value={form.product_slug} onChange={(e) => setForm({ ...form, product_slug: e.target.value })} />
              <input placeholder="Tier label (e.g. Weekly Pass)" value={form.tier_label} onChange={(e) => setForm({ ...form, tier_label: e.target.value })} />
              <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input placeholder="Image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              <textarea rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input type="number" placeholder="Supplier cost" value={form.supplier_cost_inr} onChange={(e) => setForm({ ...form, supplier_cost_inr: Number(e.target.value) })} />
              <input type="number" placeholder="Selling price" value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: Number(e.target.value) })} />
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">No supplier</option>
                {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={form.stock_status} onChange={(e) => setForm({ ...form, stock_status: e.target.value })}>
                <option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option>
              </select>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={save} className="rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
              <button onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
