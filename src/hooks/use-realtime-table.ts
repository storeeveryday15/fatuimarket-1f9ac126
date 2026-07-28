import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Options = {
  /** Column used for ordering the initial fetch. */
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  /** Disable the subscription (e.g. before the admin guard resolves). */
  enabled?: boolean;
};

/**
 * Generic "load once + stay live" hook.
 *
 * Fetches a table, then subscribes to Postgres changes for that table and
 * refetches on any change. Refetching (rather than patching rows in place)
 * keeps ordering, filters and computed joins correct with very little code,
 * and these admin tables are small.
 */
export function useRealtimeTable<T>(table: string, options: Options = {}) {
  const { orderBy = "created_at", ascending = false, limit, enabled = true } = options;
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    let query = supabase.from(table as never).select("*");
    if (orderBy) query = query.order(orderBy, { ascending });
    if (limit) query = query.limit(limit);
    const { data, error: err } = await query;
    if (!mounted.current) return;
    if (err) setError(err.message);
    else {
      setError(null);
      setRows((data ?? []) as T[]);
    }
  }, [table, orderBy, ascending, limit]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    void load();

    const channel = supabase
      .channel(`realtime:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void load();
      })
      .subscribe();

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [table, enabled, load]);

  return { rows, error, reload: load, loading: rows === null };
}
