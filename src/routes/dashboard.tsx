import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My orders — Fatui Market" },
      { name: "description", content: "View your Fatui Market order history, track current orders, and check payment status." },
      { property: "og:title", content: "My orders — Fatui Market" },
      { property: "og:description", content: "Track your game top-up orders and payment history at Fatui Market." },
      { property: "og:url", content: "https://fatuimarket.lovable.app/dashboard" },
    ],
    links: [{ rel: "canonical", href: "https://fatuimarket.lovable.app/dashboard" }],
  }),
  component: DashboardPage,
});

type Order = {
  id: string;
  order_code: string;
  product_name: string;
  tier_label: string;
  amount_inr: number | null;
  amount_usd: number | null;
  currency: string;
  status: string;
  created_at: string;
  utr: string | null;
};

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
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function DashboardPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [email, setEmail] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { navigate({ to: "/auth" }); return; }
      setEmail(data.user.email ?? "");
      const { data: rows } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      setOrders((rows ?? []) as Order[]);
    });
  }, [navigate]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">My orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {email}</p>
        </div>
        <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
          New top-up <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-8 grid gap-3">
        {orders === null ? (
          <div className="surface-card p-10 text-center text-sm text-muted-foreground">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="surface-card flex flex-col items-center gap-3 p-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <div className="text-lg font-semibold">No orders yet</div>
            <div className="text-sm text-muted-foreground">Your top-ups will appear here.</div>
            <Link to="/" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground">Browse top-ups</Link>
          </div>
        ) : (
          orders.map((o) => (
            <Link
              key={o.id}
              to="/orders/$code"
              params={{ code: o.order_code }}
              className="surface-card flex flex-wrap items-center justify-between gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
            >
              <div>
                <div className="font-mono text-xs text-[var(--neon)]">{o.order_code}</div>
                <div className="mt-1 font-semibold">{o.product_name} · {o.tier_label}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {o.currency === "INR" ? `₹${o.amount_inr}` : `$${o.amount_usd}`}
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
