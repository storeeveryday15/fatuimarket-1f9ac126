import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_VISITOR_STATS, fetchVisitorStats, type VisitorStats } from "@/lib/visitor-session";

/** Real-time visitor analytics (guests + signed-in), sourced from site_visitors. */
export function VisitorAnalytics() {
  const [stats, setStats] = useState<VisitorStats>(EMPTY_VISITOR_STATS);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const next = await fetchVisitorStats();
      if (alive && next) setStats(next);
    };
    load();
    const t = setInterval(load, 15_000);
    const ch = supabase
      .channel("admin-visitor-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visitors" }, load)
      .subscribe();
    return () => { alive = false; clearInterval(t); supabase.removeChannel(ch); };
  }, []);

  const items = [
    { label: "🟢 Online now", value: stats.online, accent: "text-emerald-400" },
    { label: "📅 Visitors today", value: stats.today, accent: "text-purple-300" },
    { label: "🌍 Total visitors", value: stats.total, accent: "text-blue-300" },
    { label: "🖥 Desktop", value: stats.desktop, accent: "text-sky-300" },
    { label: "📱 Mobile", value: stats.mobile, accent: "text-pink-300" },
  ];

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="surface-card p-4">
          <div className="text-xs text-muted-foreground">{i.label}</div>
          <div className={`mt-1 text-2xl font-bold ${i.accent}`}>{i.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
