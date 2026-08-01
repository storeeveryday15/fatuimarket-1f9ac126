import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Ban, CheckCircle2, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProduct } from "@/lib/products";
import { inr, isCompleted, useAdminMetrics, type MetricProfile } from "@/hooks/use-admin-metrics";
import { sendCustomerMessage } from "@/lib/admin-messaging.functions";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Fatui Market Admin" },
      { name: "description", content: "Manage Fatui Market customers: spend, orders, loyalty tier, wallet and notifications." },
      { property: "og:title", content: "Customers — Fatui Market Admin" },
      { property: "og:description", content: "Manage customers, loyalty tiers and notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

type Flag = { user_id: string; vip_level: string; banned: boolean; ban_reason: string | null; internal_notes: string | null };
type Visit = { user_id: string | null; last_seen_at: string };

function tier(spent: number) {
  if (spent >= 25000) return "Diamond";
  if (spent >= 10000) return "Platinum";
  if (spent >= 5000) return "Gold";
  if (spent >= 1000) return "Silver";
  return "Bronze";
}

const TIER_STYLE: Record<string, string> = {
  Diamond: "bg-cyan-500/15 text-cyan-300",
  Platinum: "bg-purple-500/15 text-purple-300",
  Gold: "bg-amber-500/15 text-amber-300",
  Silver: "bg-slate-400/15 text-slate-300",
  Bronze: "bg-orange-500/15 text-orange-300",
};

function CustomersPage() {
  const { orders, profiles, loading } = useAdminMetrics();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "buyers" | "suspended" | "vip">("all");
  const [active, setActive] = useState<string | null>(null);

  const loadSide = async () => {
    const [f, v] = await Promise.all([
      supabase.from("customer_flags").select("user_id,vip_level,banned,ban_reason,internal_notes"),
      supabase.from("site_visitors").select("user_id,last_seen_at").not("user_id", "is", null),
    ]);
    setFlags((f.data ?? []) as Flag[]);
    setVisits((v.data ?? []) as Visit[]);
  };

  useEffect(() => {
    void loadSide();
    const ch = supabase
      .channel("admin-customers")
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_flags" }, () => void loadSide())
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visitors" }, () => void loadSide())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const rows = useMemo(() => {
    const flagMap = new Map(flags.map((f) => [f.user_id, f]));
    const lastSeen = new Map<string, string>();
    for (const v of visits) {
      if (!v.user_id) continue;
      const prev = lastSeen.get(v.user_id);
      if (!prev || new Date(v.last_seen_at) > new Date(prev)) lastSeen.set(v.user_id, v.last_seen_at);
    }

    return profiles
      .map((p: MetricProfile) => {
        const mine = orders.filter((o) => o.user_id === p.id);
        const done = mine.filter((o) => isCompleted(o.status));
        const spent = done.reduce((s, o) => s + (Number(o.amount_inr) || 0), 0);
        const games = new Map<string, number>();
        for (const o of done) games.set(o.product_slug, (games.get(o.product_slug) ?? 0) + 1);
        const favSlug = [...games.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        return {
          profile: p,
          flag: flagMap.get(p.id),
          spent,
          orderCount: mine.length,
          completedCount: done.length,
          favorite: favSlug ? getProduct(favSlug)?.name ?? favSlug : null,
          lastPurchase: done[0]?.completed_at ?? done[0]?.created_at ?? null,
          lastLogin: lastSeen.get(p.id) ?? null,
          tier: tier(spent),
        };
      })
      .filter((r) => {
        if (filter === "buyers" && r.completedCount === 0) return false;
        if (filter === "suspended" && !r.flag?.banned) return false;
        if (filter === "vip" && !["Gold", "Platinum", "Diamond"].includes(r.tier)) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          (r.profile.username ?? "").toLowerCase().includes(q) ||
          (r.profile.email ?? "").toLowerCase().includes(q) ||
          (r.profile.display_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.spent - a.spent);
  }, [profiles, orders, flags, visits, query, filter]);

  const activeRow = rows.find((r) => r.profile.id === active) ?? null;

  const setBanned = async (userId: string, banned: boolean) => {
    const { error } = await supabase
      .from("customer_flags")
      .upsert({ user_id: userId, banned }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success(banned ? "Customer suspended" : "Customer activated");
    void loadSide();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Customers</h2>
        <p className="text-xs text-muted-foreground">{rows.length} customers · live</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username or email…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {(["all", "buyers", "vip", "suspended"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === f ? "border-[var(--neon)] text-foreground" : "border-border text-muted-foreground"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Joined</th>
              <th className="px-3 py-3">Spent</th>
              <th className="px-3 py-3">Orders</th>
              <th className="px-3 py-3">Favourite game</th>
              <th className="px-3 py-3">Tier</th>
              <th className="px-3 py-3">Wallet</th>
              <th className="px-3 py-3">Last active</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.profile.id} className="border-t border-border">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--neon)]/15 text-xs font-bold uppercase text-[var(--neon)]">
                      {(r.profile.username ?? r.profile.email ?? "?").slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold">{r.profile.username ?? r.profile.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.profile.email ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(r.profile.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-3 font-semibold tabular-nums">{inr(r.spent)}</td>
                <td className="px-3 py-3 tabular-nums">{r.completedCount}/{r.orderCount}</td>
                <td className="px-3 py-3 text-xs">{r.favorite ?? "—"}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TIER_STYLE[r.tier]}`}>{r.tier}</span>
                </td>
                <td className="px-3 py-3 tabular-nums">{inr(Number(r.profile.wallet_balance) || 0)}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {r.lastLogin ? new Date(r.lastLogin).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => setActive(r.profile.id)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary">Manage</button>
                    {r.flag?.banned ? (
                      <button onClick={() => void setBanned(r.profile.id, false)} className="rounded-md bg-success/15 px-2 py-1 text-[11px] font-semibold text-success"><CheckCircle2 className="mr-1 inline h-3 w-3" />Activate</button>
                    ) : (
                      <button onClick={() => void setBanned(r.profile.id, true)} className="rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive"><Ban className="mr-1 inline h-3 w-3" />Suspend</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">No customers match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {activeRow && (
        <CustomerDrawer
          row={activeRow}
          orders={orders.filter((o) => o.user_id === activeRow.profile.id)}
          onClose={() => setActive(null)}
          onSaved={loadSide}
        />
      )}
    </div>
  );
}

type Row = {
  profile: MetricProfile;
  flag?: Flag;
  spent: number;
  orderCount: number;
  completedCount: number;
  favorite: string | null;
  lastPurchase: string | null;
  lastLogin: string | null;
  tier: string;
};

function CustomerDrawer({
  row,
  orders,
  onClose,
  onSaved,
}: {
  row: Row;
  orders: ReturnType<typeof useAdminMetrics>["orders"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(row.flag?.internal_notes ?? "");
  const [displayName, setDisplayName] = useState(row.profile.display_name ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const send = useServerFn(sendCustomerMessage);

  const saveNotes = async () => {
    const { error } = await supabase
      .from("customer_flags")
      .upsert({ user_id: row.profile.id, internal_notes: notes }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success("Notes saved");
    onSaved();
  };

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", row.profile.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  const sendMessage = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Add a title and message");
    setSending(true);
    try {
      const res = await send({
        data: {
          targets: [{ user_id: row.profile.id, email: row.profile.email }],
          title,
          body,
          email,
          category: "system",
        },
      });
      toast.success(`Sent (${res.inApp} in-app, ${res.emails} email)`);
      setTitle("");
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{row.profile.username ?? row.profile.display_name ?? "Customer"}</h3>
            <p className="text-xs text-muted-foreground">{row.profile.email}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border p-1.5"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Info label="Total spent" value={inr(row.spent)} />
          <Info label="Orders" value={`${row.completedCount} completed / ${row.orderCount}`} />
          <Info label="Loyalty tier" value={row.tier} />
          <Info label="Wallet" value={inr(Number(row.profile.wallet_balance) || 0)} />
          <Info label="Favourite game" value={row.favorite ?? "—"} />
          <Info label="Last purchase" value={row.lastPurchase ? new Date(row.lastPurchase).toLocaleString() : "—"} />
          <Info label="Registered" value={new Date(row.profile.created_at).toLocaleString()} />
          <Info label="Status" value={row.flag?.banned ? "Suspended" : "Active"} />
        </div>

        <section className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Edit profile</h4>
          <div className="mt-2 flex gap-2">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <button onClick={() => void saveProfile()} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">Save</button>
          </div>
        </section>

        <section className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Internal notes</h4>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <button onClick={() => void saveNotes()} className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">Save notes</button>
        </section>

        <section className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Send notification</h4>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Message" className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Also send by email
          </label>
          <button onClick={() => void sendMessage()} disabled={sending} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[var(--neon)]/15 px-3 py-2 text-xs font-semibold text-[var(--neon)] disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send"}
          </button>
        </section>

        <section className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order history</h4>
          <ul className="mt-2 divide-y divide-border text-sm">
            {orders.slice(0, 25).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-[var(--neon)]">{o.order_code}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.product_name} · {o.tier_label}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold">{inr(Number(o.amount_inr) || 0)}</div>
                  <div className="text-[11px] text-muted-foreground">{o.status.replace(/_/g, " ")}</div>
                </div>
              </li>
            ))}
            {orders.length === 0 && <li className="py-3 text-xs text-muted-foreground">No orders yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
