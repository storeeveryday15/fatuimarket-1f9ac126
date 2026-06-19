import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Search, CheckCircle2, Clock, Loader2, XCircle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Order — Fatui Market" },
      { name: "description", content: "Enter your Fatui Market order ID to see live status, product, and last update time." },
      { property: "og:title", content: "Track Order — Fatui Market" },
      { property: "og:description", content: "Look up your order status in seconds." },
    ],
  }),
  component: TrackOrderPage,
});

type TrackedOrder = {
  id: string;
  order_code: string;
  product_name: string;
  tier_label: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
};

const STEPS = [
  { key: "pending_verification", label: "Pending Verification", icon: Clock },
  { key: "processing", label: "Processing", icon: Loader2 },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
] as const;

function statusIndex(status: string): number {
  if (status === "pending_payment" || status === "pending_verification" || status === "awaiting_verification") return 0;
  if (status === "processing" || status === "paid") return 1;
  if (status === "completed" || status === "delivered") return 2;
  return -1;
}

function TrackOrderPage() {
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);
    const trimmed = code.trim();
    if (!trimmed) { setError("Please enter an order ID."); return; }
    setSearching(true);
    // RLS limits results to the signed-in user's own orders
    const { data, error: err } = await supabase
      .from("orders")
      .select("id, order_code, product_name, tier_label, status, created_at, updated_at, completed_at, rejected_at")
      .eq("order_code", trimmed)
      .maybeSingle();
    setSearching(false);
    if (err) { setError(err.message); return; }
    if (!data) { setError("No order found with that ID under your account."); return; }
    setOrder(data as TrackedOrder);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6 text-[var(--neon)]" />
        <h1 className="text-3xl font-bold">Track your order</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your order ID (e.g. <span className="font-mono">FM-XXXXXX</span>) to see live status.
      </p>

      {authReady && !signedIn && (
        <div className="mt-6 surface-card p-5 text-sm">
          <p className="text-muted-foreground">For your privacy, you must sign in with the same email used when ordering to view your order.</p>
          <Link to="/auth" search={{ redirect: "/track" }} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground">
            Sign in to track <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {signedIn && (
        <form onSubmit={lookup} className="mt-6 surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order ID</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="FM-ABC123"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm font-mono"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {searching ? "Searching…" : "Track order"}
          </button>
        </form>
      )}

      {error && <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {order && <OrderResult order={order} />}
    </div>
  );
}

function OrderResult({ order }: { order: TrackedOrder }) {
  const idx = statusIndex(order.status);
  const rejected = order.status === "rejected" || order.status === "cancelled";
  const lastUpdated = order.updated_at ?? order.completed_at ?? order.rejected_at ?? order.created_at;

  return (
    <div className="mt-6 surface-card p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Order ID</div>
          <div className="font-mono text-xl font-bold text-[var(--neon)]">{order.order_code}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <Field label="Product" value={order.product_name} />
        {order.tier_label && <Field label="Item" value={order.tier_label} />}
        <Field label="Order Date" value={new Date(order.created_at).toLocaleString()} />
        <Field label="Last Updated" value={new Date(lastUpdated).toLocaleString()} />
      </div>

      <div className="mt-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</div>
        {rejected ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <XCircle className="h-6 w-6 text-destructive" />
            <div>
              <div className="font-semibold text-destructive">Order rejected</div>
              <div className="text-xs text-muted-foreground">Please contact support for assistance.</div>
            </div>
          </div>
        ) : (
          <ol className="mt-3 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const done = i < idx;
              const active = i === idx;
              const Icon = s.icon;
              return (
                <li key={s.key} className="flex flex-1 items-center gap-2">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? "border-success bg-success/15 text-success" : active ? "border-[var(--neon)] bg-[var(--neon)]/15 text-[var(--neon)]" : "border-border text-muted-foreground"}`}>
                    <Icon className={`h-4 w-4 ${active && s.key === "processing" ? "animate-spin" : ""}`} />
                  </div>
                  <div className="hidden text-xs font-medium sm:block">{s.label}</div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${done ? "bg-success" : "bg-border"}`} />}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/orders/$code"
          params={{ code: order.order_code }}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          View full details <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/contact" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
          Need help?
        </Link>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending_payment: { label: "Pending Payment", className: "bg-warning/15 text-warning" },
    pending_verification: { label: "Pending Verification", className: "bg-blue-500/15 text-blue-500" },
    awaiting_verification: { label: "Pending Verification", className: "bg-blue-500/15 text-blue-500" },
    paid: { label: "Processing", className: "bg-purple-500/15 text-purple-500" },
    processing: { label: "Processing", className: "bg-purple-500/15 text-purple-500" },
    completed: { label: "Completed", className: "bg-success/20 text-success" },
    delivered: { label: "Completed", className: "bg-success/20 text-success" },
    rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
    cancelled: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
  };
  const s = map[status] ?? { label: status, className: "bg-secondary" };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${s.className}`}>{s.label}</span>;
}
