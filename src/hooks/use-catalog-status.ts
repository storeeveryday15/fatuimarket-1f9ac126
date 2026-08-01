import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aggregateStockState, resolveStockState, type StockSource, type StockState } from "@/lib/stock-status";

type Row = StockSource & { id: string; product_slug: string; tier_label: string; name: string | null };

const SELECT = "id,product_slug,tier_label,name,product_type,stock,status,display_status,low_stock_threshold,auto_status";

/**
 * Loads every visible catalog row once and keeps it live, so any grid on the
 * storefront can ask for a per-game or per-tier stock state without extra
 * round trips.
 */
export function useCatalogStatus() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      supabase
        .from("catalog_products_public")
        .select(SELECT)
        .then(({ data, error }) => {
          if (!alive) return;
          if (error) {
            console.error("[useCatalogStatus] load failed", error);
            return;
          }
          setRows((data ?? []) as unknown as Row[]);
        });
    };
    load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`realtime:catalog-status:${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "catalog_products" }, load)
        .subscribe();
    } catch (err) {
      console.error("[useCatalogStatus] realtime unavailable", err);
    }

    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return useMemo(() => {
    const bySlug = new Map<string, Row[]>();
    for (const r of rows) {
      const list = bySlug.get(r.product_slug) ?? [];
      list.push(r);
      bySlug.set(r.product_slug, list);
    }
    return {
      loaded: rows.length > 0,
      /** Aggregate state for a whole game card. */
      gameState: (slug: string): StockState => aggregateStockState(bySlug.get(slug) ?? []),
      /** State for one tier of a game. */
      tierState: (slug: string, tier: string): StockState => {
        const list = bySlug.get(slug) ?? [];
        return resolveStockState(list.find((r) => r.tier_label === tier || r.name === tier));
      },
    };
  }, [rows]);
}
