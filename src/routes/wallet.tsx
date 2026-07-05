import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownRight, RefreshCw, Gift, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { createWalletTopup, verifyWalletTopup } from "@/lib/wallet.functions";

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
};
type RazorpayInstance = { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
type RazorpayCtor = new (opts: RazorpayCheckoutOptions) => RazorpayInstance;

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Fatui Market" },
      { name: "description", content: "Top up your Fatui Market wallet and view transaction history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletPage,
});

const PRESETS = [50, 100, 200, 500, 1000];

type Tx = {
  id: string;
  type: string;
  amount_inr: number;
  description: string | null;
  created_at: string;
  order_id: string | null;
};

function WalletPage() {
  const { status, user } = useRequireAuth();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | "custom">(100);
  const [custom, setCustom] = useState("");
  const [processing, setProcessing] = useState(false);

  const createTopup = useServerFn(createWalletTopup);
  const verifyTopup = useServerFn(verifyWalletTopup);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: prof }, { data: tx }] = await Promise.all([
      supabase.from("profiles").select("wallet_balance").eq("id", user.id).maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("id,type,amount_inr,description,created_at,order_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setBalance(Number((prof as { wallet_balance?: number } | null)?.wallet_balance ?? 0));
    setTxns((tx ?? []) as Tx[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (status === "authed") void refresh(); }, [status, refresh]);

  const amount = selected === "custom" ? Number(custom) : selected;
  const amountValid = Number.isFinite(amount) && amount >= 10 && amount <= 100000 && Number.isInteger(amount);

  const topUp = async () => {
    if (!user) return;
    if (!amountValid) return toast.error("Enter a whole amount between ₹10 and ₹1,00,000");
    setProcessing(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) throw new Error("Failed to load Razorpay");
      const rzpOrder = await createTopup({ data: { amount_inr: amount } });

      const rzp = new window.Razorpay({
        key: rzpOrder.key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: "Fatui Market",
        description: `Fatui Market Wallet Top Up`,
        order_id: rzpOrder.order_id,
        prefill: { email: user.email ?? undefined },
        theme: { color: "#10b981" },
        handler: async (response) => {
          try {
            const result = await verifyTopup({
              data: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (!result.verified) {
              toast.error("Payment verification failed");
              return;
            }
            toast.success(`₹${result.amount_inr.toFixed(2)} added to your wallet`);
            setBalance(result.balance);
            await refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Verification failed");
          }
        },
        modal: { ondismiss: () => toast.message("Top-up cancelled") },
      });
      rzp.on("payment.failed", () => toast.error("Payment failed. Please try again."));
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setProcessing(false);
    }
  };

  if (status === "loading") {
    return <div className="container mx-auto px-4 py-24 text-center text-sm text-muted-foreground">Loading wallet…</div>;
  }
  if (status !== "authed") return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Wallet</h1>
          <p className="text-sm text-muted-foreground">Top up and pay faster on future orders.</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="surface-card overflow-hidden p-6 bg-[image:var(--gradient-primary)] text-primary-foreground">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
          <WalletIcon className="h-4 w-4" /> Current balance
        </div>
        <div className="mt-2 font-display text-4xl font-bold">₹{balance.toFixed(2)}</div>
      </div>

      <section className="surface-card mt-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top up wallet</h2>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setSelected(p); setCustom(""); }}
              className={`rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${
                selected === p
                  ? "border-[var(--neon)] bg-[var(--neon)]/10 text-foreground"
                  : "border-border bg-background/40 hover:bg-secondary"
              }`}
            >
              ₹{p}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label className="text-xs text-muted-foreground">Custom amount (min ₹10)</label>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 flex items-center rounded-lg border border-border bg-background/40 px-3">
              <span className="text-sm text-muted-foreground">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={10}
                max={100000}
                step={1}
                value={custom}
                onChange={(e) => { setCustom(e.target.value); setSelected("custom"); }}
                placeholder="Enter amount"
                className="w-full bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
          </div>
        </div>
        <button
          onClick={topUp}
          disabled={processing || !amountValid}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {processing ? "Opening Razorpay…" : `Top up ₹${amountValid ? amount : "—"}`}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Payments are processed securely via Razorpay (UPI, Cards, Netbanking).
        </p>
      </section>

      <section className="surface-card mt-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Transaction history</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : txns.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {txns.map((t) => <TxRow key={t.id} tx={t} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function TxRow({ tx }: { tx: Tx }) {
  const positive = Number(tx.amount_inr) >= 0;
  const meta = typeMeta(tx.type);
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-full ${meta.bg}`}>
          <meta.Icon className={`h-4 w-4 ${meta.color}`} />
        </div>
        <div>
          <div className="text-sm font-medium capitalize">{meta.label}</div>
          <div className="text-[11px] text-muted-foreground">
            {tx.description ?? "—"} · {new Date(tx.created_at).toLocaleString()}
          </div>
        </div>
      </div>
      <div className={`text-sm font-semibold ${positive ? "text-success" : "text-destructive"}`}>
        {positive ? "+" : ""}₹{Number(tx.amount_inr).toFixed(2)}
      </div>
    </li>
  );
}

function typeMeta(type: string) {
  switch (type) {
    case "topup":
      return { label: "Top-up", Icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" };
    case "cashback":
      return { label: "Cashback", Icon: Gift, color: "text-[var(--neon)]", bg: "bg-[var(--neon)]/10" };
    case "refund":
      return { label: "Refund", Icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" };
    case "spend":
    case "purchase":
      return { label: "Purchase", Icon: ShoppingBag, color: "text-destructive", bg: "bg-destructive/10" };
    default:
      return { label: type, Icon: ArrowDownRight, color: "text-muted-foreground", bg: "bg-muted" };
  }
}

// Suppress unused import warning if Link isn't used above.
void Link;
void useNavigate;
