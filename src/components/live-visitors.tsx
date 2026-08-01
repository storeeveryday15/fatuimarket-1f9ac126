import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_VISITOR_STATS,
  fetchVisitorStats,
  sendVisitorHeartbeat,
  type VisitorStats,
} from "@/lib/visitor-session";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const HEARTBEAT_MS = 15_000;
const REFRESH_MS = 15_000;

export function LiveVisitors() {
  const [stats, setStats] = useState<VisitorStats>(EMPTY_VISITOR_STATS);
  const [open, setOpen] = useState(false);
  const lastFetch = useRef(0);

  const refresh = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetch.current < 5_000) return; // avoid realtime bursts
    lastFetch.current = now;
    const next = await fetchVisitorStats();
    if (next) setStats(next);
  }, []);

  useEffect(() => {
    let alive = true;

    const beat = async () => {
      if (document.visibilityState === "hidden") return; // inactive tabs go stale after 60s
      await sendVisitorHeartbeat();
      if (alive) refresh(true);
    };

    beat();

    const hb = setInterval(beat, HEARTBEAT_MS);
    const st = setInterval(() => refresh(true), REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVisible);

    const ch = supabase
      .channel("visitor-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visitors" }, () => refresh())
      .subscribe();

    return () => {
      alive = false;
      clearInterval(hb);
      clearInterval(st);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 backdrop-blur transition-all hover:border-emerald-400/50 hover:bg-emerald-500/20 sm:gap-2 sm:px-3 sm:text-xs"
        aria-label="View live visitor stats"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
        </span>
        <span className="whitespace-nowrap">
          {stats.online} <span className="hidden sm:inline">online now</span>
          <span className="sm:hidden">live</span>
        </span>
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
            <div className="grid grid-cols-2 gap-3">
              <StatRow label="🖥 Desktop" value={stats.desktop} accent="text-sky-300" />
              <StatRow label="📱 Mobile" value={stats.mobile} accent="text-pink-300" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatRow({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value.toLocaleString()}</span>
    </div>
  );
}
