import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Users, Package, Search, Eye, Star, Trash2 } from "lucide-react";
import { notifyOrder } from "@/lib/notify-order";
import { VisitorAnalytics } from "@/components/admin/visitor-analytics";


export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — Fatui Market" },
      { name: "description", content: "Fatui Market admin dashboard for managing orders, verifying payments, reviewing customer feedback, and monitoring store performance." },
      { property: "og:title", content: "Admin — Fatui Market" },
      { property: "og:description", content: "Manage orders, verify payments, review feedback, and monitor Fatui Market performance." },
      { property: "og:url", content: "https://fatuimarket.lovable.app/admin" },
    ],
    links: [{ rel: "canonical", href: "https://fatuimarket.lovable.app/admin" }],
  }),
  component: AdminPage,
});

type Order = {
  id: string;
  order_code: string;
  user_id: string | null;
  customer_email: string | null;
  player_name: string | null;
  game_id: string | null;
  server_id: string | null;
  server_region: string | null;
  product_name: string;
  tier_label: string;
  amount_inr: number | null;
  amount_usd: number | null;
  currency: string;
  payment_method: string | null;
  utr: string | null;
  screenshot_url: string | null;
  admin_notes: string | null;
  completed_at: string | null;
  rejected_at?: string | null;
  status: string;
  created_at: string;
};

type Support = { id: string; name: string | null; contact: string | null; message: string; status: string; created_at: string };
type Profile = { id: string; username: string | null; email: string | null; display_name: string | null; created_at: string };
type Review = { id: string; user_id: string | null; product_slug: string | null; full_name: string; display_name: string; rating: number; review: string; status: string; created_at: string };

const STATUSES = ["pending_payment", "pending_verification", "completed", "rejected", "refunded", "cancelled", "failed", "expired"] as const;

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-warning/15 text-warning",
  pending_verification: "bg-blue-500/15 text-blue-500",
  awaiting_verification: "bg-blue-500/15 text-blue-500",
  processing: "bg-purple-500/15 text-purple-500",
  paid: "bg-success/15 text-success",
  completed: "bg-success/20 text-success",
  delivered: "bg-success/20 text-success",
  rejected: "bg-destructive/15 text-destructive",
  refunded: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
  failed: "bg-destructive/10 text-destructive/80",
  expired: "bg-muted text-muted-foreground",
};

function AdminPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "orders" | "users" | "support" | "reviews">("dashboard");
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [support, setSupport] = useState<Support[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const load = async () => {
    const [{ data: o }, { data: s }, { data: p }, { data: r }] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("support_messages").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
    ]);
    setOrders((o ?? []) as Order[]);
    setSupport((s ?? []) as Support[]);
    setUsers((p ?? []) as Profile[]);
    setReviews((r ?? []) as Review[]);
  };

  useEffect(() => {
    (async () => {
      // Access is already enforced by the /admin layout guard.
      setReady(true);
      try { await supabase.rpc("expire_stale_orders" as never); } catch { /* ignore */ }
      await load();
    })();
  }, []);

  const openOrder = async (o: Order) => {
    setActiveOrder(o);
    setShotUrl(null);
    if (o.screenshot_url) {
      const { data } = await supabase.storage.from("payment-screenshots").createSignedUrl(o.screenshot_url, 600);
      setShotUrl(data?.signedUrl ?? null);
    }
  };

  const updateOrder = async (id: string, patch: Partial<Order>, event?: "processing" | "completed" | "rejected") => {
    if (event === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Order updated");
    if (event) {
      const order = orders.find((x) => x.id === id);
      if (order) {
        void notifyOrder(order.order_code, event);
      }
    }

    await load();
    if (activeOrder?.id === id) {
      const fresh = orders.find((o) => o.id === id);
      if (fresh) setActiveOrder({ ...fresh, ...patch });
    }
  };

  if (!ready) return <div className="container mx-auto max-w-5xl px-4 py-16 text-center text-sm text-muted-foreground">Loading admin…</div>;

  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.order_code.toLowerCase().includes(q) ||
      (o.customer_email ?? "").toLowerCase().includes(q) ||
      (o.player_name ?? "").toLowerCase().includes(q) ||
      (o.game_id ?? "").toLowerCase().includes(q)
    );
  });

  const usersFiltered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.username ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.display_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <Dashboard orders={orders} users={users} />

      <div className="mt-8 flex flex-wrap gap-2 border-b border-border">
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")}><Package className="mr-1.5 inline h-4 w-4" /> Dashboard</TabBtn>
        <TabBtn active={tab === "orders"} onClick={() => setTab("orders")}>Orders ({orders.length})</TabBtn>
        <TabBtn active={tab === "users"} onClick={() => setTab("users")}><Users className="mr-1.5 inline h-4 w-4" /> Users ({users.length})</TabBtn>
        <TabBtn active={tab === "support"} onClick={() => setTab("support")}><MessageSquare className="mr-1.5 inline h-4 w-4" /> Support ({support.filter(s => s.status === "open").length})</TabBtn>
        <TabBtn active={tab === "reviews"} onClick={() => setTab("reviews")}><Star className="mr-1.5 inline h-4 w-4" /> Reviews ({reviews.length})</TabBtn>
      </div>

      {(tab === "orders" || tab === "users" || tab === "reviews") && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "orders" ? "Search code, email, UID, player…" : tab === "reviews" ? "Search reviews by customer name…" : "Search username or email…"} className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm" />
          </div>
          {tab === "orders" && ["all", ...STATUSES].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-3 py-1 text-xs ${filter === s ? "border-[var(--neon)] text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>{s.replace(/_/g, " ")}</button>
          ))}
          {tab === "reviews" && (["all","pending","approved","rejected"] as const).map((s) => (
            <button key={s} onClick={() => setReviewFilter(s)} className={`rounded-full border px-3 py-1 text-xs capitalize ${reviewFilter === s ? "border-[var(--neon)] text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>{s} {s !== "all" && `(${reviews.filter(r => r.status === s).length})`}</button>
          ))}
        </div>
      )}

      {tab === "orders" && (
        <OrdersTable orders={filtered} onOpen={openOrder} onQuickStatus={(id, st, ev) => updateOrder(id, { status: st }, ev)} />
      )}

      {tab === "users" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-3">Username</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Display name</th><th className="px-3 py-3">Joined</th></tr>
            </thead>
            <tbody>
              {usersFiltered.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-3 font-mono">{u.username ?? "—"}</td>
                  <td className="px-3 py-3">{u.email ?? "—"}</td>
                  <td className="px-3 py-3">{u.display_name ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {usersFiltered.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">No users.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "support" && (
        <div className="mt-4 grid gap-3">
          {support.map((s) => (
            <div key={s.id} className="surface-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{s.name || "Guest"}</div>
                  <div className="text-xs text-muted-foreground">{s.contact ?? ""} · {new Date(s.created_at).toLocaleString()}</div>
                </div>
                <select value={s.status} onChange={async (e) => { await supabase.from("support_messages").update({ status: e.target.value }).eq("id", s.id); load(); }} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                  <option value="open">open</option><option value="replied">replied</option><option value="closed">closed</option>
                </select>
              </div>
              <p className="mt-2 text-sm">{s.message}</p>
            </div>
          ))}
          {support.length === 0 && <div className="surface-card p-10 text-center text-sm text-muted-foreground">No messages yet.</div>}
        </div>
      )}

      {tab === "reviews" && (
        <>
          <ReviewsStats reviews={reviews} />
          <ReviewsAdmin
            reviews={reviews.filter((r) => {
              if (reviewFilter !== "all" && r.status !== reviewFilter) return false;
              if (!search.trim()) return true;
              const q = search.toLowerCase();
              return (
                r.full_name.toLowerCase().includes(q) ||
                r.display_name.toLowerCase().includes(q) ||
                r.review.toLowerCase().includes(q) ||
                (r.product_slug ?? "").toLowerCase().includes(q)
              );
            })}
            onChange={async (id, patch) => {
              const { error } = await supabase.from("reviews").update(patch).eq("id", id);
              if (error) return toast.error(error.message);
              toast.success("Review updated");
              load();
            }}
            onDelete={async (id) => {
              if (!confirm("Delete this review?")) return;
              const { error } = await supabase.from("reviews").delete().eq("id", id);
              if (error) return toast.error(error.message);
              toast.success("Review deleted");
              load();
            }}
          />
        </>
      )}

      {activeOrder && (
        <OrderDrawer order={activeOrder} screenshotUrl={shotUrl} onClose={() => setActiveOrder(null)} onAction={updateOrder} />
      )}
    </div>
  );
}

function Dashboard({ orders, users }: { orders: Order[]; users: Profile[] }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const completed = orders.filter((o) => o.status === "completed" || o.status === "delivered");
  const revenueToday = completed.filter((o) => o.completed_at && new Date(o.completed_at) >= today).reduce((s, o) => s + (Number(o.amount_inr) || 0), 0);
  const pending = orders.filter((o) => o.status === "pending_payment" || o.status === "pending_verification" || o.status === "awaiting_verification").length;
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total orders" value={orders.length.toString()} />
        <Stat label="Pending" value={pending.toString()} highlight />
        <Stat label="Completed" value={completed.length.toString()} />
        <Stat label="Registered users" value={users.length.toString()} />
        <Stat label="Revenue today" value={`₹${revenueToday.toFixed(0)}`} />
      </div>
      <VisitorAnalytics />
    </>
  );
}

function OrdersTable({ orders, onOpen, onQuickStatus }: { orders: Order[]; onOpen: (o: Order) => void; onQuickStatus: (id: string, status: string, event?: "processing" | "completed" | "rejected") => void }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-3">Order</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Server / Region</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Proof</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border align-top">
              <td className="px-3 py-3">
                <div className="font-mono text-[var(--neon)]">{o.order_code}</div>
                <div className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
              </td>
              <td className="px-3 py-3">
                <div className="font-medium">{o.player_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{o.customer_email ?? "—"}</div>
                {o.game_id && <div className="mt-1 text-xs">🎮 {o.game_id}</div>}
              </td>
              <td className="px-3 py-3">
                <div className="font-semibold">{o.product_name}</div>
                <div className="text-xs text-muted-foreground">{o.tier_label}</div>
              </td>
              <td className="px-3 py-3">
                {o.server_region ? (
                  <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">{o.server_region}</span>
                ) : o.server_id ? (
                  <span className="text-xs">Zone/Server: <span className="font-mono">{o.server_id}</span></span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-3 font-semibold">
                {o.currency === "INR" ? `₹${o.amount_inr}` : `$${o.amount_usd}`}
                {o.utr && <div className="text-[11px] font-mono text-muted-foreground">UTR: {o.utr}</div>}
              </td>
              <td className="px-3 py-3">
                {o.screenshot_url ? <span className="rounded bg-success/15 px-2 py-1 text-[11px] font-semibold text-success">✓ uploaded</span> : <span className="text-[11px] text-muted-foreground">none</span>}
              </td>
              <td className="px-3 py-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[o.status] ?? "bg-secondary"}`}>{o.status.replace(/_/g, " ")}</span>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-1">
                  <button onClick={() => onOpen(o)} className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary"><Eye className="h-3 w-3" /> View</button>
                  <button onClick={() => onQuickStatus(o.id, "completed", "completed")} className="rounded-md bg-success/15 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/25">Complete</button>
                  <button onClick={() => onQuickStatus(o.id, "rejected", "rejected")} className="rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25">Reject</button>
                  <button onClick={() => onQuickStatus(o.id, "refunded")} className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary">Refund</button>
                </div>
              </td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">No orders.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function OrderDrawer({ order, screenshotUrl, onClose, onAction }: {
  order: Order;
  screenshotUrl: string | null;
  onClose: () => void;
  onAction: (id: string, patch: Partial<Order>, event?: "processing" | "completed" | "rejected") => void;
}) {
  const [notes, setNotes] = useState(order.admin_notes ?? "");
  useEffect(() => { setNotes(order.admin_notes ?? ""); }, [order.id]);
  const saveNotes = () => onAction(order.id, { admin_notes: notes });
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/50" />
      <div className="h-full w-full max-w-xl overflow-y-auto bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-lg font-bold text-[var(--neon)]">{order.order_code}</div>
            <div className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-2 py-1 text-xs">Close</button>
        </div>
        <div className="mt-4 grid gap-2 rounded-lg bg-background/40 p-4 text-sm">
          <KV k="Status" v={order.status} />
          <KV k="Product" v={`${order.product_name} — ${order.tier_label}`} />
          <KV k="Player" v={order.player_name ?? "—"} />
          <KV k="Game UID" v={order.game_id ?? "—"} />
          {order.server_region && <KV k="Server / Region" v={order.server_region} />}
          {order.server_id && <KV k="Zone / Server ID" v={order.server_id} />}
          <KV k="Email" v={order.customer_email ?? "—"} />
          <KV k="Amount" v={order.currency === "INR" ? `₹${order.amount_inr}` : `$${order.amount_usd}`} />
          <KV k="UTR" v={order.utr ?? "—"} />
          {order.completed_at && <KV k="Completed" v={new Date(order.completed_at).toLocaleString()} />}
        </div>
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment screenshot</div>
          {screenshotUrl ? (
            <a href={screenshotUrl} target="_blank" rel="noreferrer">
              <img src={screenshotUrl} alt="Payment screenshot" className="mt-2 max-h-80 w-full rounded-lg border border-border object-contain" />
            </a>
          ) : <div className="mt-2 rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No screenshot uploaded yet</div>}
        </div>
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Internal/customer-visible note" />
          <button onClick={saveNotes} className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Save notes</button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button onClick={() => onAction(order.id, { status: "completed" }, "completed")} className="rounded-lg bg-success/15 px-3 py-2 text-sm font-semibold text-success">Complete</button>
          <button onClick={() => onAction(order.id, { status: "rejected", rejected_at: new Date().toISOString() }, "rejected")} className="rounded-lg bg-destructive/15 px-3 py-2 text-sm font-semibold text-destructive">Reject</button>
          <button onClick={() => onAction(order.id, { status: "refunded" })} className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">Refund</button>
          <button onClick={() => onAction(order.id, { status: "cancelled" })} className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive/80">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>;
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`surface-card p-4 ${highlight ? "ring-1 ring-[var(--neon)]/40" : ""}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--neon)]" />}
    </button>
  );
}



function ReviewsAdmin({ reviews, onChange, onDelete }: {
  reviews: Review[];
  onChange: (id: string, patch: Partial<Review>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-3">Reviewer</th>
            <th className="px-3 py-3">Rating</th>
            <th className="px-3 py-3">Review</th>
            <th className="px-3 py-3">Product</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-3 py-3">
                <div className="font-medium">{r.full_name}</div>
                <div className="text-[11px] text-muted-foreground">Public: {r.display_name}</div>
                <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </td>
              <td className="px-3 py-3">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
                  ))}
                </div>
              </td>
              <td className="px-3 py-3 max-w-md"><div className="line-clamp-3 whitespace-pre-wrap">{r.review}</div></td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{r.product_slug ?? "site"}</td>
              <td className="px-3 py-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "approved" ? "bg-success/15 text-success" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{r.status}</span>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-1">
                  <button onClick={() => onChange(r.id, { status: "approved" })} className="rounded-md bg-success/15 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/25">Approve</button>
                  <button onClick={() => onChange(r.id, { status: "pending" })} className="rounded-md bg-warning/15 px-2 py-1 text-[11px] font-semibold text-warning hover:bg-warning/25">Pending</button>
                  <button onClick={() => onChange(r.id, { status: "rejected" })} className="rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25">Reject</button>
                  <button onClick={() => onDelete(r.id)} className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary"><Trash2 className="h-3 w-3" /> Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {reviews.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No reviews.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ReviewsStats({ reviews }: { reviews: Review[] }) {
  const approved = reviews.filter((r) => r.status === "approved");
  const pending = reviews.filter((r) => r.status === "pending").length;
  const rejected = reviews.filter((r) => r.status === "rejected").length;
  const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-4">
      <Stat label="Total reviews" value={reviews.length.toString()} />
      <Stat label="Pending" value={pending.toString()} highlight />
      <Stat label="Approved" value={approved.length.toString()} />
      <div className="surface-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Avg rating · Rejected</div>
        <div className="mt-1 flex items-center gap-3">
          <div className="flex items-center gap-1 text-2xl font-bold">
            {avg.toFixed(1)}
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          </div>
          <div className="text-xs text-muted-foreground">· {rejected} rejected</div>
        </div>
      </div>
    </div>
  );
}
