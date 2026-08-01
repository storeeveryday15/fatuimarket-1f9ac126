import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS } from "@/lib/products";

type FeedRow = { product_name: string; tier_label: string; created_at: string };
type CatalogRow = { product_slug: string; tier_label: string; name: string | null; updated_at: string; created_at: string };

export type StoreSignals = {
  /** Orders counted per game slug. */
  gameSales: Record<string, number>;
  /** Orders counted per `${slug}|${tier}` key. */
  tierSales: Record<string, number>;
  /** Latest catalog update per game slug (used for "recently restocked"). */
  gameRestockedAt: Record<string, number>;
  /** Catalog creation time per game slug (used for "newest"). */
  gameCreatedAt: Record<string, number>;
  tierRestockedAt: Record<string, number>;
};

const EMPTY: StoreSignals = {
  gameSales: {},
  tierSales: {},
  gameRestockedAt: {},
  gameCreatedAt: {},
  tierRestockedAt: {},
};

/**
 * Public sales + catalog freshness signals used to power "Best selling",
 * "Most popular", "Newest" and "Recently restocked" sorting on the storefront.
 */
export function useStoreSignals(): StoreSignals {
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);

  useEffect(() => {
    let alive = true;

    supabase
      .from("public_orders_feed")
      .select("product_name,tier_label,created_at")
      .limit(500)
      .then(({ data }) => {
        if (alive && data) setFeed(data as FeedRow[]);
      });

    supabase
      .from("catalog_products_public")
      .select("product_slug,tier_label,name,updated_at,created_at")
      .then(({ data }) => {
        if (alive && data) setCatalog(data as unknown as CatalogRow[]);
      });

    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => {
    if (!feed.length && !catalog.length) return EMPTY;

    const slugByName = new Map(PRODUCTS.map((p) => [p.name.toLowerCase(), p.slug]));
    const out: StoreSignals = { gameSales: {}, tierSales: {}, gameRestockedAt: {}, gameCreatedAt: {}, tierRestockedAt: {} };

    for (const r of feed) {
      const slug = slugByName.get((r.product_name ?? "").toLowerCase());
      if (!slug) continue;
      out.gameSales[slug] = (out.gameSales[slug] ?? 0) + 1;
      const key = `${slug}|${r.tier_label}`;
      out.tierSales[key] = (out.tierSales[key] ?? 0) + 1;
    }

    for (const r of catalog) {
      const updated = new Date(r.updated_at).getTime() || 0;
      const created = new Date(r.created_at).getTime() || 0;
      out.gameRestockedAt[r.product_slug] = Math.max(out.gameRestockedAt[r.product_slug] ?? 0, updated);
      out.gameCreatedAt[r.product_slug] = Math.max(out.gameCreatedAt[r.product_slug] ?? 0, created);
      for (const tier of [r.tier_label, r.name].filter(Boolean) as string[]) {
        const key = `${r.product_slug}|${tier}`;
        out.tierRestockedAt[key] = Math.max(out.tierRestockedAt[key] ?? 0, updated);
      }
    }

    return out;
  }, [feed, catalog]);
}
