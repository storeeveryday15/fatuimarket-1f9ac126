import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Trophy } from "lucide-react";

type Row = {
  rank: number;
  masked_username: string;
  country: string | null;
  total_orders: number;
  total_spent_inr: number;
  level: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
};

const LEVEL_STYLES: Record<Row["level"], { chip: string; badge: string; emoji: string }> = {
  Bronze:   { chip: "bg-amber-700/20 text-amber-300 border-amber-500/30",       badge: "⭐ Loyal", emoji: "🥉" },
  Silver:   { chip: "bg-slate-400/15 text-slate-200 border-slate-300/30",       badge: "⭐ Loyal", emoji: "🥈" },
  Gold:     { chip: "bg-yellow-500/15 text-yellow-300 border-yellow-400/30",    badge: "🔥 Top Buyer", emoji: "🥇" },
  Platinum: { chip: "bg-cyan-400/15 text-cyan-200 border-cyan-300/30",          badge: "💎 VIP", emoji: "💎" },
  Diamond:  { chip: "bg-purple-500/20 text-purple-200 border-purple-400/40",    badge: "👑 Legend", emoji: "👑" },
};

function flagEmoji(country: string | null | undefined): string {
  if (!country || country.length !== 2) return "🌍";
  const cc = country.toUpperCase();
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return String.fromCodePoint(A + (cc.charCodeAt(0) - a), A + (cc.charCodeAt(1) - a));
}

function medalFor(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function TopCustomers() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [limit, setLimit] = useState(10);

  const fetchRows = async (l: number) => {
    const { data } = await supabase.rpc("get_leaderboard", { _limit: l });
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => {
    fetchRows(limit);
    const ch = supabase
      .channel("leaderboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchRows(limit))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [limit]);

  return (
    <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-black/60 to-black/80 p-5 backdrop-blur-xl md:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <h2 className="text-xl font-bold md:text-2xl">Top Customers</h2>
        </div>
        <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-200">
          VIP Leaderboard
        </span>
      </div>

      {rows === null ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading leaderboard…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Crown className="h-8 w-8 text-purple-300/60" />
          <div className="text-base font-semibold">Be the first customer!</div>
          <p className="text-xs text-muted-foreground">Complete your first order to claim the crown.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((r) => {
              const s = LEVEL_STYLES[r.level];
              const isTop = r.rank <= 3;
              return (
                <li
                  key={r.rank}
                  className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 backdrop-blur transition-all sm:gap-4 ${
                    isTop
                      ? "border-purple-400/30 bg-gradient-to-r from-purple-500/10 via-white/[0.03] to-transparent"
                      : "border-white/5 bg-white/[0.03]"
                  }`}
                >
                  <span className="w-10 shrink-0 text-center text-2xl">{medalFor(r.rank)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">{r.masked_username}</span>
                      <span className="text-lg" aria-label={r.country ?? "unknown"}>{flagEmoji(r.country)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      🛍 {r.total_orders} orders
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-300">₹{Number(r.total_spent_inr).toLocaleString("en-IN")}</div>
                    <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.chip}`}>
                        {s.emoji} {r.level}
                      </span>
                      {isTop && (
                        <span className="inline-flex items-center rounded-full border border-purple-400/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
                          {s.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {limit === 10 && rows.length === 10 && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setLimit(50)}
                className="rounded-full border border-purple-400/30 bg-purple-500/10 px-5 py-2 text-xs font-semibold text-purple-200 transition-all hover:bg-purple-500/20"
              >
                View Full Leaderboard →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
