import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  order_code: string;
  product_name: string;
  tier_label: string;
  amount_inr: number | null;
  currency: string;
  created_at: string;
  status?: string;
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.max(1, Math.floor(d))}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// Derive a friendly pseudo-name from the order code so no PII is exposed
function nickFromCode(code: string) {
  const NAMES = ["Rahul", "Ken", "Ayaan", "Aditya", "Neha", "Priya", "Arjun", "Kiran", "Rohan", "Sara", "Vikram", "Meera", "Dev", "Ishan", "Zoya"];
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const first = NAMES[h % NAMES.length];
  return `${first}****`;
}

export function RecentPurchases() {
  const [rows, setRows] = useState<Row[] | null>(null);

  const fetchRows = async () => {
    const { data } = await supabase
      .from("public_orders_feed")
      .select("*")
      .limit(8);
    if (!data) { setRows([]); return; }
    const completed = (data as Row[]).filter((r) => !r.status || ["completed", "delivered"].includes(r.status));
    setRows(completed);
  };

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel("recent-purchases")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchRows())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/60 via-purple-950/20 to-black/60 p-5 backdrop-blur-xl md:p-7">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <h2 className="text-xl font-bold md:text-2xl">Recent purchases</h2>
      </div>

      {rows === null ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">No data available yet — be the first customer!</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.order_code}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                <span className="font-semibold">{nickFromCode(r.order_code)}</span>
                <span className="text-muted-foreground">purchased</span>
                <span className="font-semibold text-purple-200">{r.product_name}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{r.tier_label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
