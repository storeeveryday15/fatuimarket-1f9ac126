import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Server } from "@/lib/products";

export type GameServerRow = {
  id: string;
  product_slug: string;
  server_code: string;
  label: string;
  sort_order: number;
  active: boolean;
};

/**
 * Server/region options for a game, managed from the admin panel.
 * Falls back to the built-in list while loading or if none are configured.
 */
export function useGameServers(slug: string, fallback: Server[] = []) {
  const [servers, setServers] = useState<Server[]>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("game_servers")
      .select("server_code,label,sort_order,active")
      .eq("product_slug", slug)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        setLoading(false);
        if (error) {
          console.error("[useGameServers] load failed", error);
          return;
        }
        const rows = (data ?? []) as Array<{ server_code: string; label: string }>;
        if (rows.length) setServers(rows.map((r) => ({ id: r.server_code, label: r.label })));
        else setServers(fallback);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return { servers, loading };
}
