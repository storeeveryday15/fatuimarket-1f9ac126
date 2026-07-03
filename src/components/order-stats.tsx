import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, TrendingUp, Zap } from "lucide-react";

type Stats = { successful: number; total_relevant: number; success_rate: number };

export function OrderStats() {
  const [s, setS] = useState<Stats | null>(null);

  const fetchStats = async () => {
    const { data } = await supabase.rpc("get_order_stats");
    if (data && Array.isArray(data) && data[0]) {
      setS({
        successful: data[0].successful ?? 0,
        total_relevant: data[0].total_relevant ?? 0,
        success_rate: Number(data[0].success_rate ?? 0),
      });
    }
  };

  useEffect(() => {
    fetchStats();
    const ch = supabase
      .channel("order-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchStats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cards = [
    { icon: CheckCircle2, label: "Successful Orders", value: s ? s.successful.toLocaleString("en-IN") : "—", accent: "text-emerald-300" },
    { icon: TrendingUp,  label: "Success Rate",       value: s && s.total_relevant > 0 ? `${s.success_rate}%` : "—", accent: "text-purple-300" },
    { icon: Zap,         label: "Real-time updates",  value: "Live", accent: "text-blue-300" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/5 via-white/[0.02] to-transparent p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <c.icon className={`h-4 w-4 ${c.accent}`} />
            {c.label}
          </div>
          <div className={`mt-2 text-2xl font-bold ${c.accent}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
