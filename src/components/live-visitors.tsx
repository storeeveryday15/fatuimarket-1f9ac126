import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorSessionId } from "@/lib/visitor-session";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Stats = { online: number; today: number; total: number };

export function LiveVisitors() {
  const [stats, setStats] = useState<Stats>({ online: 0, today: 0, total: 0 });
  const [open, setOpen] = useState(false);

  const fetchStats = async () => {
    const { data } = await supabase.rpc("get_visitor_stats");
    if (data && Array.isArray(data) && data[0]) {
      setStats({ online: data[0].online ?? 0, today: data[0].today ?? 0, total: data[0].total ?? 0 });
    }
  };

  useEffect(() => {
    const sessionId = getVisitorSessionId();
    if (!sessionId) return;

    const heartbeat = async () => {
      await supabase.from("site_visitors").upsert(
        { session_id: sessionId, last_seen_at: new Date().toISOString() },
        { onConflict: "session_id" },
      );
    };

    heartbeat();
    fetchStats();

    const hb = setInterval(heartbeat, 30_000);
    const st = setInterval(fetchStats, 15_000);

    const ch = supabase
      .channel("visitor-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visitors" }, () => fetchStats())
      .subscribe();

    return () => {
      clearInterval(hb);
      clearInterval(st);
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur transition-all hover:border-emerald-400/50 hover:bg-emerald-500/20"
        aria-label="View live visitor stats"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
        </span>
        <span>{stats.online} online now</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-purple-500/20 bg-black/90 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Live visitor stats</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <StatRow label="🟢 Online now" value={stats.online} accent="text-emerald-400" />
            <StatRow label="📅 Visitors today" value={stats.today} accent="text-purple-300" />
            <StatRow label="🌍 Total visitors" value={stats.total} accent="text-blue-300" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatRow({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value.toLocaleString()}</span>
    </div>
  );
}
