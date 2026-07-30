import { useEffect, useState, useCallback, useRef, useId } from "react";
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
 * refetches on any change.
 *
 * Every instance uses its own channel topic. Supabase-js reuses a channel when
 * the topic already exists, and calling `.on("postgres_changes", ...)` on an
 * already-subscribed channel throws — which is exactly what happened when two
 * components (the notification bell and the notification list) watched the same
 * table at once.
 *
 * All Supabase interaction is defensive: any failure degrades to an empty (or
 * last-known) list plus an `error` string rather than throwing into React.
 */
export function useRealtimeTable<T>(table: string, options: Options = {}) {
  const { orderBy = "created_at", ascending = false, limit, enabled = true } = options;
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const instanceId = useId();

  const load = useCallback(async () => {
    try {
      let query = supabase.from(table as never).select("*");
      if (orderBy) query = query.order(orderBy, { ascending });
      if (limit) query = query.limit(limit);
      const { data, error: err } = await query;
      if (!mounted.current) return;
      if (err) {
        console.error(`[useRealtimeTable] failed to load "${table}":`, err);
        setError(err.message);
        // Never leave consumers in a permanent loading state.
        setRows((prev) => prev ?? []);
      } else {
        setError(null);
        setRows((data ?? []) as T[]);
      }
    } catch (err) {
      console.error(`[useRealtimeTable] unexpected error loading "${table}":`, err);
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load data");
      setRows((prev) => prev ?? []);
    }
  }, [table, orderBy, ascending, limit]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    void load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`realtime:${table}:${instanceId}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          void load();
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`[useRealtimeTable] realtime channel "${table}" status: ${status}`);
          }
        });
    } catch (err) {
      // Realtime is a nice-to-have: the fetched rows still render without it.
      console.error(`[useRealtimeTable] could not subscribe to "${table}":`, err);
      channel = null;
    }

    return () => {
      mounted.current = false;
      if (!channel) return;
      try {
        void supabase.removeChannel(channel);
      } catch (err) {
        console.error(`[useRealtimeTable] could not remove channel for "${table}":`, err);
      }
    };
  }, [table, enabled, load, instanceId]);

  return { rows, error, reload: load, loading: rows === null };
}
