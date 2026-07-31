/**
 * Inventory domain types + helpers shared by the admin product manager and the
 * customer-facing stock badges.
 *
 * The schema is intentionally supplier-agnostic: products carry a
 * `supplier_name` / `supplier_id` and a `supplier_url`, so a future supplier
 * API sync can write prices and stock into the same rows without a rebuild.
 */

export type ProductType = "unlimited" | "limited";
export type ProductStatus = "active" | "hidden" | "out_of_stock";

export type Category = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type InventoryProduct = {
  id: string;
  category_id: string | null;
  name: string | null;
  product_slug: string;
  tier_label: string;
  category: string | null;
  image_url: string | null;
  description: string | null;
  price_inr: number;
  supplier_cost_inr: number;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_url: string | null;
  product_type: ProductType | string;
  stock: number;
  status: ProductStatus | string;
  visible: boolean;
  featured: boolean;
  auto_pricing: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type InventoryHistoryRow = {
  id: string;
  catalog_product_id: string | null;
  order_id: string | null;
  change: number;
  new_stock: number | null;
  reason: string;
  note: string | null;
  created_at: string;
};

export type CategoryStats = {
  category_id: string;
  total_products: number;
  active_products: number;
  out_of_stock_products: number;
  total_inventory: number;
  total_sales: number;
  revenue_inr: number;
  profit_inr: number;
};

export const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/15 text-success" },
  hidden: { label: "Hidden", className: "bg-secondary text-muted-foreground" },
  out_of_stock: { label: "Out of Stock", className: "bg-destructive/15 text-destructive" },
};

export const LOW_STOCK_THRESHOLD = 100;

/** Human label for the stock cell / badge. */
export function stockLabel(p: Pick<InventoryProduct, "product_type" | "stock">): string {
  if (p.product_type !== "limited") return "Unlimited Stock";
  if (p.stock <= 0) return "Out of Stock";
  return String(p.stock);
}

/** Customer-facing availability for a limited/unlimited product. */
export function availability(p: Pick<InventoryProduct, "product_type" | "stock" | "status">) {
  if (p.status === "out_of_stock" || (p.product_type === "limited" && p.stock <= 0)) {
    return { soldOut: true, label: "Out of Stock", low: false } as const;
  }
  if (p.product_type === "limited" && p.stock < LOW_STOCK_THRESHOLD) {
    return { soldOut: false, label: `🔥 Only ${p.stock} left`, low: true } as const;
  }
  if (p.product_type === "limited") {
    return { soldOut: false, label: `In Stock: ${p.stock}`, low: false } as const;
  }
  return { soldOut: false, label: "", low: false } as const;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
