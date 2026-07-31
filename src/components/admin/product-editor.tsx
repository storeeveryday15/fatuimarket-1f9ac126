import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Category, InventoryProduct } from "@/lib/admin/inventory";

type FormState = {
  name: string;
  product_slug: string;
  tier_label: string;
  category_id: string;
  price_inr: number;
  supplier_cost_inr: number;
  product_type: string;
  stock: number;
  status: string;
  supplier_name: string;
  image_url: string;
  description: string;
};

const blank = (categoryId: string, slug: string): FormState => ({
  name: "",
  product_slug: slug,
  tier_label: "",
  category_id: categoryId,
  price_inr: 0,
  supplier_cost_inr: 0,
  product_type: "unlimited",
  stock: 0,
  status: "active",
  supplier_name: "",
  image_url: "",
  description: "",
});

const field =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

/** Slide-over used for both "Add product" and "Edit product". */
export function ProductEditor({
  open,
  onClose,
  product,
  category,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  product: InventoryProduct | null;
  category: Category | null;
  categories: Category[];
}) {
  const [form, setForm] = useState<FormState>(blank(category?.id ?? "", category?.slug ?? ""));
  const [saving, setSaving] = useState(false);
  const [addStock, setAddStock] = useState(0);

  useEffect(() => {
    if (!open) return;
    setAddStock(0);
    if (product) {
      setForm({
        name: product.name ?? product.tier_label,
        product_slug: product.product_slug,
        tier_label: product.tier_label,
        category_id: product.category_id ?? category?.id ?? "",
        price_inr: Number(product.price_inr),
        supplier_cost_inr: Number(product.supplier_cost_inr),
        product_type: product.product_type,
        stock: Number(product.stock ?? 0),
        status: product.status,
        supplier_name: product.supplier_name ?? "",
        image_url: product.image_url ?? "",
        description: product.description ?? "",
      });
    } else {
      setForm(blank(category?.id ?? "", category?.slug ?? ""));
    }
  }, [open, product, category]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const name = form.name.trim();
    if (!name) return toast.error("Product name is required");
    if (!form.category_id) return toast.error("Pick a category");
    const cat = categories.find((c) => c.id === form.category_id);
    const payload = {
      name,
      tier_label: form.tier_label.trim() || name,
      product_slug: (form.product_slug || cat?.slug || "").trim(),
      category_id: form.category_id,
      category: cat?.name ?? null,
      price_inr: Number(form.price_inr) || 0,
      supplier_cost_inr: Number(form.supplier_cost_inr) || 0,
      product_type: form.product_type,
      stock: form.product_type === "limited" ? Math.max(0, Number(form.stock) || 0) : 0,
      status: form.status,
      supplier_name: form.supplier_name.trim() || null,
      image_url: form.image_url.trim() || null,
      description: form.description.trim() || null,
    };

    setSaving(true);
    try {
      if (product) {
        const before = Number(product.stock ?? 0);
        const { error } = await supabase.from("catalog_products").update(payload).eq("id", product.id);
        if (error) throw error;
        if (payload.product_type === "limited" && payload.stock !== before) {
          await supabase.from("inventory_history").insert({
            catalog_product_id: product.id,
            change: payload.stock - before,
            new_stock: payload.stock,
            reason: "manual_edit",
            note: "Stock set from product editor",
          });
        }
      } else {
        const { data, error } = await supabase.from("catalog_products").insert(payload).select("id").single();
        if (error) throw error;
        if (payload.product_type === "limited" && payload.stock > 0 && data?.id) {
          await supabase.from("inventory_history").insert({
            catalog_product_id: data.id,
            change: payload.stock,
            new_stock: payload.stock,
            reason: "initial_stock",
          });
        }
      }
      toast.success("Saved");
      onClose();
    } catch (err) {
      console.error("[ProductEditor] save failed", err);
      toast.error(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  const applyRestock = async () => {
    if (!product) return;
    const amount = Math.trunc(Number(addStock) || 0);
    if (amount <= 0) return toast.error("Enter an amount greater than 0");
    const next = Math.max(0, Number(form.stock) || 0) + amount;
    try {
      const { error } = await supabase
        .from("catalog_products")
        .update({ stock: next, status: form.status === "out_of_stock" ? "active" : form.status })
        .eq("id", product.id);
      if (error) throw error;
      await supabase.from("inventory_history").insert({
        catalog_product_id: product.id,
        change: amount,
        new_stock: next,
        reason: "restock",
      });
      setForm((f) => ({ ...f, stock: next, status: f.status === "out_of_stock" ? "active" : f.status }));
      setAddStock(0);
      toast.success(`Restocked — new total ${next}`);
    } catch (err) {
      console.error("[ProductEditor] restock failed", err);
      toast.error(err instanceof Error ? err.message : "Could not add stock");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="flex-1 bg-black/50 backdrop-blur-sm" />
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-bold">{product ? "Edit product" : "Add product"}</div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Product name
            <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Weekly Pass" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Category
              <select className={field} value={form.category_id} onChange={(e) => {
                const c = categories.find((x) => x.id === e.target.value);
                setForm((f) => ({ ...f, category_id: e.target.value, product_slug: c?.slug ?? f.product_slug }));
              }}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Status
              <select className={field} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Selling price (₹)
              <input type="number" className={field} value={form.price_inr} onChange={(e) => set("price_inr", Number(e.target.value))} />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Cost price (₹)
              <input type="number" className={field} value={form.supplier_cost_inr} onChange={(e) => set("supplier_cost_inr", Number(e.target.value))} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Product type
              <select className={field} value={form.product_type} onChange={(e) => set("product_type", e.target.value)}>
                <option value="unlimited">Unlimited (instant top-up)</option>
                <option value="limited">Limited (tracked stock)</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Stock
              <input
                type="number"
                className={field}
                disabled={form.product_type !== "limited"}
                value={form.product_type === "limited" ? form.stock : 0}
                onChange={(e) => set("stock", Number(e.target.value))}
                placeholder={form.product_type === "limited" ? "1400" : "Unlimited"}
              />
            </label>
          </div>

          {product && form.product_type === "limited" && (
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add stock</div>
              <div className="mt-2 flex items-end gap-2">
                <input type="number" className={field} value={addStock} onChange={(e) => setAddStock(Number(e.target.value))} placeholder="500" />
                <button type="button" onClick={applyRestock} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
                  Add
                </button>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Current: {form.stock} → New total: {Math.max(0, Number(form.stock) || 0) + Math.max(0, Math.trunc(Number(addStock) || 0))}
              </div>
            </div>
          )}

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Supplier name
            <input className={field} value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} placeholder="e.g. SmileOne" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Image URL
            <input className={field} value={form.image_url} onChange={(e) => set("image_url", e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Description
            <textarea rows={3} className={field} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={save} disabled={saving} className="rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}
