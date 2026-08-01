import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/admin/stat-card";
import { getProduct } from "@/lib/products";
import { inr, isCompleted, useAdminMetrics } from "@/hooks/use-admin-metrics";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Fatui Market Admin" },
      { name: "description", content: "Live revenue, orders, traffic and product analytics for Fatui Market." },
      { property: "og:title", content: "Analytics — Fatui Market Admin" },
      { property: "og:description", content: "Live revenue, orders, traffic and product analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

type Breakdown = { browser: string; device_type: string; referrer: string; sessions: number; avg_session_seconds: number };
type Growth = { day: string; visitors: number };
type ViewRow = { product_slug: string; tier_label: string; views: number };

const COLORS = ["#a78bfa", "#34d399", "#38bdf8", "#f472b6", "#fbbf24", "#f87171", "#c084fc"];

function bucketKey(date: Date, mode: "day" | "week" | "month") {
  if (mode === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (mode === "week") {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function AnalyticsPage() {
  const { orders, profiles, visitors, metrics, loading } = useAdminMetrics();
  const [mode, setMode] = useState<"day" | "week" | "month">("day");
  const [breakdown, setBreakdown] = useState<Breakdown[]>([]);
  const [growth, setGrowth] = useState<Growth[]>([]);
  const [views, setViews] = useState<ViewRow[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [b, g, v] = await Promise.all([
        supabase.rpc("admin_visitor_breakdown"),
        supabase.rpc("admin_visitor_growth", { _days: 30 }),
        supabase.rpc("admin_product_views", { _days: 30 }),
      ]);
      if (!alive) return;
      setBreakdown((b.data ?? []) as Breakdown[]);
      setGrowth((g.data ?? []) as Growth[]);
      setViews((v.data ?? []) as ViewRow[]);
    };
    void load();
    const ch = supabase
      .channel("admin-analytics")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visitors" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_views" }, () => void load())
      .subscribe();
    const poll = setInterval(() => void load(), 30_000);
    return () => {
      alive = false;
      clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, []);

  const revenueSeries = useMemo(() => {
    const map = new Map<string, { key: string; revenue: number; orders: number }>();
    for (const o of orders) {
      const created = new Date(o.created_at);
      const key = bucketKey(created, mode);
      const entry = map.get(key) ?? { key, revenue: 0, orders: 0 };
      entry.orders += 1;
      if (isCompleted(o.status)) entry.revenue += Number(o.amount_inr) || 0;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-30);
  }, [orders, mode]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; units: number }>();
    for (const o of orders.filter((x) => isCompleted(x.status))) {
      const entry = map.get(o.tier_label) ?? { name: o.tier_label, revenue: 0, units: 0 };
      entry.revenue += Number(o.amount_inr) || 0;
      entry.units += 1;
      map.set(o.tier_label, entry);
    }
    return [...map.values()].sort((a, b) => b.units - a.units).slice(0, 8);
  }, [orders]);

  const topGames = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; units: number }>();
    for (const o of orders.filter((x) => isCompleted(x.status))) {
      const name = getProduct(o.product_slug)?.name ?? o.product_name;
      const entry = map.get(name) ?? { name, revenue: 0, units: 0 };
      entry.revenue += Number(o.amount_inr) || 0;
      entry.units += 1;
      map.set(name, entry);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [orders]);

  const customerGrowth = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of profiles) {
      const key = bucketKey(new Date(p.created_at), mode);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    let running = 0;
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, n]) => ({ key, joined: n, total: (running += n) }))
      .slice(-30);
  }, [profiles, mode]);

  const deviceSplit = useMemo(
    () =>
      [
        { name: "Desktop", value: visitors.desktop },
        { name: "Mobile", value: visitors.mobile },
        { name: "Tablet", value: visitors.tablet },
      ].filter((d) => d.value > 0),
    [visitors],
  );

  const browserSplit = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of breakdown) map.set(b.browser, (map.get(b.browser) ?? 0) + b.sessions);
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [breakdown]);

  const traffic = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of breakdown) map.set(b.referrer, (map.get(b.referrer) ?? 0) + b.sessions);
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [breakdown]);

  const avgSession = useMemo(() => {
    const total = breakdown.reduce((s, b) => s + b.sessions, 0);
    if (!total) return 0;
    return breakdown.reduce((s, b) => s + b.avg_session_seconds * b.sessions, 0) / total;
  }, [breakdown]);

  const totalViews = views.reduce((s, v) => s + v.views, 0);
  const mostViewed = views[0];
  const mostViewedGame = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of views) {
      const name = getProduct(v.product_slug)?.name ?? v.product_slug;
      map.set(name, (map.get(name) ?? 0) + v.views);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [views]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Analytics</h2>
          <p className="text-xs text-muted-foreground">Live data — updates automatically.</p>
        </div>
        <div className="flex gap-1.5">
          {(["day", "week", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                mode === m ? "border-[var(--neon)] text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {m === "day" ? "Daily" : m === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue (all time)" value={inr(metrics.revenueTotal)} tone="neon" loading={loading} />
        <StatCard label="Conversion rate" value={`${metrics.conversionRate.toFixed(2)}%`} sub="completed orders / visitors" loading={loading} />
        <StatCard label="Returning customers" value={metrics.repeatCustomers.toString()} sub={`${metrics.uniqueBuyers} unique buyers`} loading={loading} />
        <StatCard
          label="Avg. session"
          value={avgSession >= 60 ? `${Math.round(avgSession / 60)}m` : `${Math.round(avgSession)}s`}
          loading={loading}
        />
        <StatCard label="Product views (30d)" value={totalViews.toLocaleString()} loading={loading} />
        <StatCard label="Most viewed product" value={mostViewed ? mostViewed.tier_label || mostViewed.product_slug : "—"} sub={mostViewed ? `${mostViewed.views} views` : undefined} loading={loading} />
        <StatCard label="Most viewed game" value={mostViewedGame ? mostViewedGame[0] : "—"} sub={mostViewedGame ? `${mostViewedGame[1]} views` : undefined} loading={loading} />
        <StatCard label="Visitors today" value={visitors.today.toLocaleString()} sub={`${visitors.online} online now`} tone="good" loading={loading} />
      </div>

      <ChartCard title={`Revenue (${mode})`}>
        <AreaChart data={revenueSeries}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
          <XAxis dataKey="key" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
          <Area type="monotone" dataKey="revenue" stroke="#a78bfa" fill="url(#rev)" strokeWidth={2} />
        </AreaChart>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Orders">
          <BarChart data={revenueSeries}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis dataKey="key" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Bar dataKey="orders" fill="#38bdf8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Customer growth">
          <AreaChart data={customerGrowth}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis dataKey="key" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Area type="monotone" dataKey="total" stroke="#34d399" fill="#34d39933" strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Visitor growth (30 days)">
          <AreaChart data={growth}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Area type="monotone" dataKey="visitors" stroke="#f472b6" fill="#f472b633" strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Top selling products">
          <BarChart data={topProducts} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
            <Tooltip contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Bar dataKey="units" fill="#fbbf24" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top selling games (revenue)">
          <BarChart data={topGames} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
            <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Bar dataKey="revenue" fill="#c084fc" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Traffic sources">
          <BarChart data={traffic} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
            <Tooltip contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
            <Bar dataKey="value" fill="#34d399" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Device split">
          <PieChart>
            <Pie data={deviceSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
              {deviceSplit.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Browser split">
          <PieChart>
            <Pie data={browserSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
              {browserSplit.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip contentStyle={{ background: "rgba(10,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
          </PieChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="surface-card p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
