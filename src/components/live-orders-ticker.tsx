import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type FeedRow = {
  order_code: string;
  product_name: string;
  tier_label: string;
  created_at: string;
  status?: string;
  masked_buyer?: string | null;
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return `${Math.floor(d / 86400)} d ago`;
}

const ROTATE_MS = 6000;

export function LiveOrdersTicker() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [index, setIndex] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchRows = async () => {
    const { data } = await supabase
      .from("public_orders_feed")
      .select("order_code,product_name,tier_label,created_at,status,masked_buyer")
      .limit(12);
    setRows((data ?? []) as FeedRow[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(Boolean(role));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel("ticker-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchRows())
      .subscribe();
    const poll = setInterval(fetchRows, 30000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (rows.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % rows.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [rows.length]);

  if (isAdmin || rows.length === 0) return null;

  const row = rows[index % rows.length];
  if (!row) return null;

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-full border border-border/50 bg-card/40 px-4 py-2 backdrop-blur">
      <span className="flex shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Live orders
      </span>
      <span className="hidden text-muted-foreground sm:inline">•</span>
      <div key={row.order_code + index} className="min-w-0 flex-1 animate-fade-in truncate text-xs sm:text-sm">
        <span className="font-semibold text-[var(--neon)]">{row.masked_buyer ?? "Player"}</span>
        <span className="text-muted-foreground"> purchased </span>
        <span className="font-semibold">{row.tier_label}</span>
        <span className="text-muted-foreground"> · {timeAgo(row.created_at)}</span>
      </div>
    </div>
  );
}
