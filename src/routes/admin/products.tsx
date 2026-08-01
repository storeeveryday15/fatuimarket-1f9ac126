import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { useAdminProducts } from "@/hooks/use-admin-products";
import { ProductEditor } from "@/components/admin/product-editor";
import { inr } from "@/lib/admin/pricing";
import {
  fmtDate,
  stockLabel,
  STATUS_META,
  type Category,
  type CategoryStats,
  type InventoryProduct,
} from "@/lib/admin/inventory";

export const Route = createFileRoute("/admin/products")({ component: ProductsPage });

type Filter = "all" | "active" | "hidden" | "out_of_stock" | "unlimited" | "limited";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "hidden", label: "Hidden" },
  { id: "out_of_stock", label: "Out of Stock" },
  { id: "unlimited", label: "Unlimited" },
  { id: "limited", label: "Limited" },
];

function ProductsPage() {
  const { rows: categories, loading: catLoading } = useRealtimeTable<Category>("product_categories", {
    orderBy: "sort_order",
    ascending: true,
  });
  const { rows: products, loading } = useAdminProducts();

  const [stats, setStats] = useState<CategoryStats[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const cats = useMemo(() => categories ?? [], [categories]);
  const items = useMemo(() => products ?? [], [products]);

  useEffect(() => {
    let alive = true;
    supabase
      .rpc("get_category_stats")
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("[admin/products] category stats failed", error);
          return;
        }
        setStats((data ?? []) as CategoryStats[]);
      });
    return () => {
      alive = false;
    };
  }, [items]);

  const statFor = (id: string): CategoryStats => {
    const serverStats = stats.find((s) => s.category_id === id);
    const categoryProducts = items.filter((product) => product.category_id === id);

    // Inventory counts come from the same admin catalog rows rendered below.
    // This keeps the category cards connected to the existing catalog even if
    // the aggregate helper cannot read protected supplier/cost columns.
    return {
      category_id: id,
      total_products: categoryProducts.length,
      active_products: categoryProducts.filter((product) => product.status === "active").length,
      out_of_stock_products: categoryProducts.filter((product) => product.status === "out_of_stock").length,
      total_inventory: categoryProducts.reduce(
        (total, product) => total + (product.product_type === "limited" ? Number(product.stock) || 0 : 0),
        0,
      ),
      total_sales: Number(serverStats?.total_sales ?? 0),
      revenue_inr: Number(serverStats?.revenue_inr ?? 0),
      profit_inr: Number(serverStats?.profit_inr ?? 0),
    };
  };
  const category = cats.find((c) => c.id === activeCat) ?? null;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (activeCat && p.category_id !== activeCat) return false;
      if (filter === "active" && p.status !== "active") return false;
      if (filter === "hidden" && p.status !== "hidden") return false;
      if (filter === "out_of_stock" && p.status !== "out_of_stock") return false;
      if (filter === "limited" && p.product_type !== "limited") return false;
      if (filter === "unlimited" && p.product_type !== "unlimited") return false;
      if (!q) return true;
      const catName = cats.find((c) => c.id === p.category_id)?.name ?? p.category ?? "";
      return (
        (p.name ?? p.tier_label).toLowerCase().includes(q) ||
        p.tier_label.toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q)
      );
    });
  }, [items, activeCat, filter, search, cats]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const quickStatus = async (p: InventoryProduct, status: string) => {
    const { error } = await supabase.from("catalog_products").update({ status }).eq("id", p.id);
    if (error) toast.error(error.message);
  };

  // ---- Category grid -------------------------------------------------------
  if (!activeCat) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">Inventory &amp; Products</h2>
            <p className="text-sm text-muted-foreground">Pick a category to manage its products.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products or categories…"
              className="w-64 rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        {search.trim() && (
          <div className="mb-6 overflow-hidden rounded-xl border border-border">
            <ProductTable
              rows={visible}
              cats={cats}
              onEdit={(p) => {
                setEditing(p);
                setEditorOpen(true);
              }}
              onStatus={quickStatus}
            />
          </div>
        )}

        {catLoading && <div className="surface-card p-10 text-center text-sm text-muted-foreground">Loading categories…</div>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => {
            const s = statFor(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className="surface-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
              >
                <div className="text-base font-bold">{c.name}</div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <Stat label="Products" value={String(s.total_products)} />
                  <Stat label="Active" value={String(s.active_products)} />
                  <Stat label="Out of stock" value={String(s.out_of_stock_products)} />
                  <Stat label="Inventory" value={String(s.total_inventory)} />
                  <Stat label="Sales" value={String(s.total_sales)} />
                  <Stat label="Revenue" value={inr(s.revenue_inr)} />
                  <Stat label="Profit" value={inr(s.profit_inr)} />
                </div>
              </button>
            );
          })}
        </div>

        <ProductEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          product={editing}
          category={null}
          categories={cats}
        />
      </div>
    );
  }

  // ---- Product list for one category --------------------------------------
  return (
    <div>
      <button onClick={() => setActiveCat(null)} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All categories
      </button>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{category?.name}</h2>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product name…"
            className="w-64 rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              filter === f.id ? "border-[var(--neon)]/60 bg-[var(--neon)]/10" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="surface-card p-10 text-center text-sm text-muted-foreground">Loading products…</div>}
      {!loading && visible.length === 0 && (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          No products in this category yet. Use “Add product” to create the first one.
        </div>
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <ProductTable
            rows={visible}
            cats={cats}
            onEdit={(p) => {
              setEditing(p);
              setEditorOpen(true);
            }}
            onStatus={quickStatus}
          />
        </div>
      )}

      <ProductEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        product={editing}
        category={category}
        categories={cats}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ProductTable({
  rows,
  cats,
  onEdit,
  onStatus,
}: {
  rows: InventoryProduct[];
  cats: Category[];
  onEdit: (p: InventoryProduct) => void;
  onStatus: (p: InventoryProduct, status: string) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="px-3 py-3">Product</th>
          <th className="px-3 py-3">Price</th>
          <th className="px-3 py-3">Stock</th>
          <th className="px-3 py-3">Type</th>
          <th className="px-3 py-3">Status</th>
          <th className="px-3 py-3">Last updated</th>
          <th className="px-3 py-3" />
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const meta = STATUS_META[p.status] ?? STATUS_META["hidden"]!;
          const catName = cats.find((c) => c.id === p.category_id)?.name ?? p.category ?? "—";
          const limited = p.product_type === "limited";
          return (
            <tr key={p.id} className="border-t border-border">
              <td className="px-3 py-3">
                <div className="font-semibold">{p.name ?? p.tier_label}</div>
                <div className="text-xs text-muted-foreground">{catName}</div>
              </td>
              <td className="px-3 py-3 font-semibold">{inr(p.price_inr)}</td>
              <td className={`px-3 py-3 tabular-nums ${limited && p.stock <= 0 ? "text-destructive" : limited && p.stock < 100 ? "text-warning" : ""}`}>
                {stockLabel(p)}
              </td>
              <td className="px-3 py-3 text-xs capitalize">{limited ? "Limited" : "Unlimited"}</td>
              <td className="px-3 py-3">
                <select
                  value={p.status}
                  onChange={(e) => onStatus(p, e.target.value)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold ${meta.className}`}
                >
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{fmtDate(p.updated_at)}</td>
              <td className="px-3 py-3">
                <button onClick={() => onEdit(p)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary">
                  Edit
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
