import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { InventoryProduct } from "@/lib/admin/inventory";

/**
 * Admin-only product list.
 *
 * Supplier cost / sourcing columns are not readable by regular roles, so full
 * rows come from the admin-checked `admin_catalog_products()` function. Stays
 * live by refetching on any catalog change.
 */
export function useAdminProducts() {
  const [rows, setRows] = useState<InventoryProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("admin_catalog_products");
    if (!mounted.current) return;
    if (err) {
      console.error("[useAdminProducts] load failed", err);
      setError(err.message);
      setRows((prev) => prev ?? []);
      return;
    }
    setError(null);
    setRows((data ?? []) as unknown as InventoryProduct[]);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`realtime:admin-catalog-products:${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "catalog_products" }, () => {
          void load();
        })
        .subscribe();
    } catch (err) {
      console.error("[useAdminProducts] realtime unavailable", err);
    }

    return () => {
      mounted.current = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load]);

  return { rows, error, reload: load, loading: rows === null };
}
