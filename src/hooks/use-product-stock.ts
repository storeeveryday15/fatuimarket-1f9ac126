import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { availability, type InventoryProduct } from "@/lib/admin/inventory";

export type StockInfo = ReturnType<typeof availability> & { tracked: boolean };

const UNTRACKED: StockInfo = { soldOut: false, label: "", low: false, tracked: false };

/**
 * Customer-side stock lookup for a product slug.
 *
 * Products that have no catalog row are "untracked": the page behaves exactly
 * as before. Rows created in the admin inventory manager start driving the
 * stock badge and the payment button automatically.
 */
export function useProductStock(productSlug: string, tierLabel: string): StockInfo {
  const [rows, setRows] = useState<Pick<InventoryProduct, "tier_label" | "name" | "product_type" | "stock" | "status">[]>([]);

  useEffect(() => {
    let alive = true;
    supabase
      .from("catalog_products")
      .select("tier_label,name,product_type,stock,status")
      .eq("product_slug", productSlug)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("[useProductStock] failed to load stock", error);
          return;
        }
        setRows((data ?? []) as typeof rows);
      });
    return () => {
      alive = false;
    };
  }, [productSlug]);

  const match = rows.find((r) => r.tier_label === tierLabel || r.name === tierLabel);
  if (!match) return UNTRACKED;
  return { ...availability(match), tracked: true };
}
