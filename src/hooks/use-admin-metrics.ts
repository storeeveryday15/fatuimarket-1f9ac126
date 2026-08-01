import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_VISITOR_STATS, fetchVisitorStats, type VisitorStats } from "@/lib/visitor-session";

export type MetricOrder = {
  id: string;
  order_code: string;
  user_id: string | null;
  customer_email: string | null;
  player_name: string | null;
  product_slug: string;
  product_name: string;
  tier_label: string;
  amount_inr: number | null;
  currency: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export type MetricProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  country: string | null;
  wallet_balance: number;
  created_at: string;
};

const COMPLETED = new Set(["completed", "delivered"]);
const PENDING = new Set(["pending_payment", "pending_verification", "awaiting_verification", "processing"]);
const CANCELLED = new Set(["cancelled", "rejected", "failed", "expired", "refunded"]);

export const isCompleted = (status: string) => COMPLETED.has(status);

/**
 * Single source of truth for every admin metric.
 *
 * Loads orders + profiles once, then keeps them live through Supabase Realtime
 * (orders, profiles, site_visitors) so every dashboard widget refreshes itself.
 */
export function useAdminMetrics() {
  const [orders, setOrders] = useState<MetricOrder[]>([]);
  const [profiles, setProfiles] = useState<MetricProfile[]>([]);
  const [visitors, setVisitors] = useState<VisitorStats>(EMPTY_VISITOR_STATS);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const [o, p, v] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,order_code,user_id,customer_email,player_name,product_slug,product_name,tier_label,amount_inr,currency,status,created_at,completed_at",
        )
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("profiles").select("id,username,display_name,email,country,wallet_balance,created_at"),
      fetchVisitorStats(),
    ]);
    if (!alive.current) return;
    if (o.data) setOrders(o.data as MetricOrder[]);
    if (p.data) setProfiles(p.data as MetricProfile[]);
    if (v) setVisitors(v);
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 600);
    };

    const channel = supabase
      .channel(`admin-metrics-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visitors" }, debounced)
      .subscribe();

    const poll = setInterval(() => void load(), 30_000);

    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const metrics = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const completed = orders.filter((o) => COMPLETED.has(o.status));
    const revenueTotal = completed.reduce((s, o) => s + (Number(o.amount_inr) || 0), 0);
    const revenueToday = completed
      .filter((o) => new Date(o.completed_at ?? o.created_at) >= startOfToday)
      .reduce((s, o) => s + (Number(o.amount_inr) || 0), 0);

    const buyers = new Map<string, number>();
    for (const o of completed) {
      const key = o.user_id ?? o.customer_email ?? "";
      if (!key) continue;
      buyers.set(key, (buyers.get(key) ?? 0) + 1);
    }
    const repeatCustomers = [...buyers.values()].filter((n) => n > 1).length;

    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => PENDING.has(o.status)).length,
      completedOrders: completed.length,
      cancelledOrders: orders.filter((o) => CANCELLED.has(o.status)).length,
      registeredUsers: profiles.length,
      revenueTotal,
      revenueToday,
      avgOrderValue: completed.length ? revenueTotal / completed.length : 0,
      conversionRate: visitors.total > 0 ? (completed.length / visitors.total) * 100 : 0,
      repeatCustomers,
      uniqueBuyers: buyers.size,
    };
  }, [orders, profiles, visitors]);

  return { orders, profiles, visitors, metrics, loading, reload: load };
}

export function maskName(name: string | null | undefined, fallback = "Player") {
  const clean = (name ?? "").trim();
  if (clean.length < 2) return fallback;
  if (clean.length <= 3) return `${clean[0]}***`;
  return `${clean[0]}***${clean[clean.length - 1]}`;
}

export function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return `${Math.floor(d / 86400)} d ago`;
}

export const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
