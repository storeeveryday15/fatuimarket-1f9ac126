import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { buildUpiLink, UPI_ID, UPI_MERCHANT, WHATSAPP_LINK } from "@/lib/products";
import { CheckCircle2, Clock, AlertCircle, Smartphone, Copy, RefreshCw, CreditCard, Timer } from "lucide-react";
import { toast } from "sonner";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { notifyOrder } from "@/lib/notify-order";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";
import { getOrderPaymentState, submitOrderUtr, paymentStateFor } from "@/lib/fatui-pay.functions";
import { safeCopy } from "@/lib/safe-browser";

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
};
type RazorpayInstance = { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
declare global {
  interface Window { Razorpay?: new (opts: RazorpayCheckoutOptions) => RazorpayInstance }
}

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


export const Route = createFileRoute("/orders/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.code} — Fatui Market` },
      { name: "description", content: `View order ${params.code} details, payment status, and delivery progress on Fatui Market.` },
      { property: "og:title", content: `Order ${params.code} — Fatui Market` },
      { property: "og:description", content: `Check the status and details of your Fatui Market order ${params.code}.` },
      { property: "og:url", content: `https://fatuimarket.lovable.app/orders/${params.code}` },
    ],
    links: [{ rel: "canonical", href: `https://fatuimarket.lovable.app/orders/${params.code}` }],
  }),
  component: OrderPage,
});

type Order = {
  id: string;
  order_code: string;
  user_id: string | null;
  product_name: string;
  tier_label: string;
  amount_inr: number | null;
  amount_usd: number | null;
  currency: string;
  region: string;
  payment_method: string | null;
  utr: string | null;
  status: string;
  game_id: string | null;
  server_id: string | null;
  player_name: string | null;
  customer_email: string | null;
  customer_contact: string | null;
  admin_notes: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  expires_at: string | null;
  needs_review: boolean | null;
  reason: string | null;
  supplier_status: string | null;
  supplier_order_id: string | null;
  delivery_details: string | null;
  created_at: string;
};

const STATE_UI: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  awaiting_payment: { icon: Clock, color: "text-warning", label: "Awaiting Payment" },
  verifying: { icon: RefreshCw, color: "text-blue-500", label: "Payment Submitted / Verifying" },
  verified: { icon: CheckCircle2, color: "text-success", label: "✅ Payment Verified" },
  rejected: { icon: AlertCircle, color: "text-destructive", label: "Payment Rejected" },
  duplicate_rrn: { icon: AlertCircle, color: "text-destructive", label: "Duplicate RRN" },
  expired: { icon: AlertCircle, color: "text-muted-foreground", label: "Order Expired" },
};

function supplierLabel(s: string) {
  switch (s) {
    case "completed": return "Delivered by supplier";
    case "failed": return "Supplier issue — our team is on it";
    case "processing": return "Being delivered";
    default: return "Queued with supplier";
  }
}

function mmss(totalSeconds: number) {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function OrderPage() {
  const { code } = Route.useParams();
  const { status: authStatus } = useRequireAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null | "loading">("loading");
  const [utr, setUtr] = useState("");
  const [qr, setQr] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const lastRefreshRef = useRef(0);
  const createRzp = useServerFn(createRazorpayOrder);
  const verifyRzp = useServerFn(verifyRazorpayPayment);
  const checkStatus = useServerFn(getOrderPaymentState);
  const sendUtr = useServerFn(submitOrderUtr);
  const [rzpLoading, setRzpLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").eq("order_code", code).maybeSingle();
    setOrder((data as Order | null) ?? null);
  }, [code]);

  useEffect(() => { if (authStatus === "authed") void fetchOrder(); }, [fetchOrder, authStatus]);

  useEffect(() => {
    if (authStatus !== "authed") return;
    const ch = supabase
      .channel(`order-${code}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `order_code=eq.${code}` }, () => void fetchOrder())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [code, authStatus, fetchOrder]);

  const paymentState = order && order !== "loading" ? paymentStateFor(order.status) : "awaiting_payment";
  const isOpen = paymentState === "awaiting_payment" || paymentState === "verifying";

  // Countdown from the server-issued expiry.
  useEffect(() => {
    if (!order || order === "loading" || !order.expires_at) return;
    const tick = () => {
      const left = Math.floor((new Date(order.expires_at as string).getTime() - Date.now()) / 1000);
      setSecondsLeft(Math.max(0, left));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order]);

  // Status refresh — only ever reads the existing order.
  const refreshStatus = useCallback(async (manual: boolean) => {
    const now = Date.now();
    if (manual && now - lastRefreshRef.current < 10_000) {
      toast.message("Please wait a few seconds before checking again");
      return;
    }
    if (refreshing) return;
    lastRefreshRef.current = now;
    setRefreshing(true);
    try {
      const state = await checkStatus({ data: { order_code: code } });
      await fetchOrder();
      if (manual) {
        if (state.payment_state === "verified") toast.success("✅ Payment Verified");
        else if (state.payment_state === "verifying") toast.message("Payment verification in progress…");
        else if (state.payment_state === "expired") toast.error("Order Expired");
        else if (state.payment_state === "duplicate_rrn") toast.error("Duplicate RRN — contact support");
        else if (state.payment_state === "rejected") toast.error("Payment Rejected");
        else toast.message("Awaiting payment");
      }
    } catch (err) {
      if (manual) toast.error(err instanceof Error ? err.message : "Could not check status");
    } finally {
      setRefreshing(false);
    }
  }, [checkStatus, code, fetchOrder, refreshing]);

  // Automatic polling while the payment is still open. Stops once verified.
  useEffect(() => {
    if (authStatus !== "authed" || !isOpen) return;
    const t = setInterval(() => { void refreshStatus(false); }, 7000);
    return () => clearInterval(t);
  }, [authStatus, isOpen, refreshStatus]);

  const upiLink = useMemo(() => {
    if (!order || order === "loading") return "";
    if (order.region !== "IN" || !order.amount_inr) return "";
    return buildUpiLink(Number(order.amount_inr), `${order.order_code} ${order.product_name}`);
  }, [order]);

  useEffect(() => {
    if (!upiLink) return;
    QRCode.toDataURL(upiLink, { width: 280, margin: 1 }).then(setQr).catch(() => {});
  }, [upiLink]);

  if (authStatus === "loading") return <div className="container mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">Checking session…</div>;
  if (authStatus !== "authed") return null;
  if (order === "loading") return <div className="container mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">Loading order…</div>;
  if (!order) return (
    <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Order not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm text-[var(--neon)] hover:underline">Back to home</Link>
    </div>
  );

  const ui = STATE_UI[paymentState] ?? STATE_UI.awaiting_payment;
  const SIcon = ui.icon;
  const awaitingPayment = paymentState === "awaiting_payment";
  const timerRunning = awaitingPayment && secondsLeft > 0;
  const checkoutClosed = awaitingPayment && secondsLeft <= 0;

  const submitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const state = await sendUtr({ data: { order_code: order.order_code, utr: utr.trim() } });
      void notifyOrder(order.order_code, "processing");
      toast.success(
        state.payment_state === "verified" ? "✅ Payment Verified" : "Reference received — verifying automatically",
      );
      setUtr("");
      await fetchOrder();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not submit your reference");
    } finally {
      setSaving(false);
    }
  };

  const payWithRazorpay = async () => {
    if (rzpLoading) return;
    if (!order || order.region !== "IN" || !order.amount_inr) {
      toast.error("Razorpay is available for INR orders");
      return;
    }
    if (!timerRunning) {
      toast.error("This checkout has expired. Please place a new order.");
      return;
    }
    setRzpLoading(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) throw new Error("Failed to load Razorpay");

      const rzpOrder = await createRzp({
        data: { order_code: order.order_code },
      });

      const rzp = new window.Razorpay({
        key: rzpOrder.key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: "Fatui Market",
        description: `Fatui Market Order ${order.order_code}`.replace(/[^\x20-\x7E]/g, "").slice(0, 255),
        order_id: rzpOrder.order_id,
        prefill: {
          name: order.player_name ?? undefined,
          email: order.customer_email ?? undefined,
        },
        theme: { color: "#10b981" },
        handler: async (response) => {
          try {
            const result = await verifyRzp({
              data: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_code: order.order_code,
              },
            });
            if (!result.verified) {
              toast.error("Payment verification failed");
              return;
            }
            toast.success(
              result.auto_fulfilled ? "Payment received — delivering your order" : "Payment received — verifying",
            );
            await fetchOrder();
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Verification failed");
          }
        },

        modal: {
          ondismiss: () => {
            toast.message("Payment cancelled");
          },
        },
      });
      rzp.on("payment.failed", () => toast.error("Payment failed. Please try again."));
      rzp.open();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setRzpLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl font-bold text-[var(--neon)]">{order.order_code}</h1>
            <div className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold ${ui.color}`}>
            <SIcon className="h-4 w-4" /> {ui.label}
          </div>
        </div>

        {timerRunning && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-warning"><Timer className="h-4 w-4" /> Complete payment within</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-warning">{mmss(secondsLeft)}</span>
          </div>
        )}
        {checkoutClosed && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            This checkout window has closed. Please place a new order. If you already paid, submit your UTR/RRN below — a payment made during the valid window is still verified automatically.
          </div>
        )}

        <div className="mt-5 grid gap-3 rounded-xl bg-background/40 p-4 text-sm">
          <Row k="Product" v={order.product_name} />
          <Row k="Item" v={order.tier_label} />
          {order.player_name && <Row k="Player" v={order.player_name} />}
          {order.game_id && <Row k="Game UID" v={order.game_id} />}
          {order.server_id && <Row k="Server ID" v={order.server_id} />}
          {order.customer_email && <Row k="Email" v={order.customer_email} />}
          <Row k="Amount" v={order.currency === "INR" ? `₹${order.amount_inr}` : `$${order.amount_usd}`} bold />
          <Row k="Payment" v={(order.payment_method ?? (order.region === "IN" ? "UPI" : "Card")).toUpperCase()} />
          {order.utr && <Row k="UTR / RRN" v={order.utr} />}
          {order.completed_at && <Row k="Completed" v={new Date(order.completed_at).toLocaleString()} />}
          {order.supplier_status && <Row k="Delivery" v={supplierLabel(order.supplier_status)} />}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void refreshStatus(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm font-semibold hover:border-foreground/30 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Checking…" : "🔄 Check Payment Status"}
          </button>
          {paymentState === "verifying" && (
            <span className="text-xs text-muted-foreground">Payment verification in progress…</span>
          )}
        </div>

        {order.delivery_details && (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-4">
            <h2 className="text-sm font-semibold text-success">Delivery details</h2>
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-foreground">{order.delivery_details}</pre>
          </div>
        )}

        {awaitingPayment && order.region === "IN" && (
          <div className="mt-6 rounded-xl border border-border bg-background/40 p-5">
            <h2 className="text-sm font-semibold">Pay with UPI</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Pay the exact order amount.</li>
              <li>Enter the UTR / RRN from your payment below.</li>
              <li>Wait — verification is fully automatic.</li>
            </ol>
            <div className="mt-4 grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex justify-center">
                <div className="rounded-2xl bg-white p-3 shadow-lg">
                  {qr ? <img src={qr} alt="UPI QR" width={220} height={220} /> : <div className="grid h-[220px] w-[220px] place-items-center text-xs text-muted-foreground">Generating…</div>}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount</div>
                  <div className="text-3xl font-bold gradient-text">₹{order.amount_inr}</div>
                </div>
                <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">UPI</div>
                  <div className="font-semibold">{UPI_MERCHANT}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <code className="text-xs">{UPI_ID}</code>
                    <button onClick={() => { void safeCopy(UPI_ID).then((ok) => (ok ? toast.success("UPI copied") : toast.error("Copy failed"))); }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px]"><Copy className="h-3 w-3" /> Copy</button>
                  </div>
                </div>
                {timerRunning ? (
                  <a href={upiLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
                    <Smartphone className="h-4 w-4" /> Pay ₹{order.amount_inr} with UPI
                  </a>
                ) : (
                  <button type="button" disabled className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-semibold text-muted-foreground opacity-70">
                    <Smartphone className="h-4 w-4" /> Checkout expired
                  </button>
                )}
                <button
                  type="button"
                  onClick={payWithRazorpay}
                  disabled={rzpLoading || !timerRunning}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--neon)]/40 bg-[var(--neon)]/10 px-5 py-3 text-sm font-semibold text-[var(--neon)] hover:bg-[var(--neon)]/20 disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" />
                  {rzpLoading ? "Opening Razorpay…" : `Pay ₹${order.amount_inr} with Card / UPI / Netbanking`}
                </button>
              </div>
            </div>
          </div>
        )}

        {awaitingPayment && order.region !== "IN" && (
          <div className="mt-6 rounded-xl border border-border bg-background/40 p-5 text-sm">
            <h2 className="font-semibold">Pay with Card / PayPal</h2>
            <p className="mt-1 text-muted-foreground">Card and PayPal checkout is being connected. For now please reach support to complete this order.</p>
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-success/15 px-4 py-2 text-sm font-semibold text-success">Contact support</a>
          </div>
        )}

        {isOpen && (
          <form onSubmit={submitUtr} className="mt-6 rounded-xl border border-border bg-background/40 p-5">
            <h2 className="text-sm font-semibold">Enter your UTR / Transaction ID (RRN)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste the reference from your payment app. Verification is automatic — no screenshot and no manual approval needed.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 412598734201" className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
              <button disabled={saving} className="rounded-xl bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {saving ? "Submitting…" : order.utr ? "Update UTR" : "Submit UTR"}
              </button>
            </div>
          </form>
        )}

        {paymentState === "verified" && (
          <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-5 text-sm text-success">
            ✅ Payment Verified — your top-up is being delivered. Enjoy the game!
          </div>
        )}

        {paymentState === "duplicate_rrn" && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
            Duplicate RRN — this payment reference was already used for another order. Please contact support.
          </div>
        )}

        {paymentState === "rejected" && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
            Payment Rejected. {order.reason ?? "Please contact support if you believe this is a mistake."}
          </div>
        )}

        {paymentState === "expired" && (
          <div className="mt-6 rounded-xl border border-border bg-background/40 p-5 text-sm text-muted-foreground">
            Order Expired — this checkout can no longer be paid. Please place a new order.
          </div>
        )}

        <div className="mt-6 flex justify-between text-xs">
          <button onClick={() => navigate({ to: "/dashboard" })} className="text-muted-foreground hover:text-foreground">← My orders</button>
          <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="text-[var(--neon)] hover:underline">Need help?</a>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{v}</span>
    </div>
  );
}
