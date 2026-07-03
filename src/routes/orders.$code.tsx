import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { buildUpiLink, UPI_ID, UPI_MERCHANT, WHATSAPP_LINK } from "@/lib/products";
import { CheckCircle2, Clock, AlertCircle, Smartphone, Copy, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRequireAuth } from "@/hooks/use-require-auth";

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
  screenshot_url: string | null;
  admin_notes: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  created_at: string;
};

function statusInfo(s: string) {
  switch (s) {
    case "pending_payment": return { icon: Clock, color: "text-warning", label: "Awaiting your payment" };
    case "awaiting_verification":
    case "pending_verification": return { icon: Clock, color: "text-blue-500", label: "Verifying payment" };
    case "processing":
    case "paid": return { icon: RefreshCw, color: "text-success", label: "Processing your order" };
    case "delivered":
    case "completed": return { icon: CheckCircle2, color: "text-success", label: "Order successful 🎉" };
    case "refunded": return { icon: AlertCircle, color: "text-muted-foreground", label: "Refunded" };
    case "rejected":
    case "cancelled": return { icon: AlertCircle, color: "text-destructive", label: "Order rejected" };
    default: return { icon: Clock, color: "text-muted-foreground", label: s };
  }
}

function OrderPage() {
  const { code } = Route.useParams();
  const { status: authStatus } = useRequireAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null | "loading">("loading");
  const [utr, setUtr] = useState("");
  const [qr, setQr] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchOrder = async () => {
    const { data } = await supabase.from("orders").select("*").eq("order_code", code).maybeSingle();
    setOrder((data as Order | null) ?? null);
    if (data?.screenshot_url) {
      const { data: signed } = await supabase.storage.from("payment-screenshots").createSignedUrl(data.screenshot_url, 600);
      setShotPreview(signed?.signedUrl ?? null);
    }
  };

  useEffect(() => { if (authStatus === "authed") fetchOrder(); }, [code, authStatus]);

  useEffect(() => {
    if (authStatus !== "authed") return;
    const ch = supabase
      .channel(`order-${code}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `order_code=eq.${code}` }, () => fetchOrder())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [code, authStatus]);

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

  const s = statusInfo(order.status);
  const SIcon = s.icon;
  const awaitingPayment = order.status === "pending_payment";

  const uploadScreenshot = async (file: File) => {
    if (!order.user_id) return toast.error("Cannot upload — order has no owner");
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${order.user_id}/${order.order_code}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-screenshots").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("orders").update({ screenshot_url: path, status: "pending_verification" }).eq("id", order.id);
      if (dbErr) throw dbErr;
      fetch("/api/public/notify-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order_code: order.order_code, event: "screenshot_uploaded" }),
      }).catch(() => {});
      toast.success("Screenshot uploaded — awaiting verification");
      await fetchOrder();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (utr.trim().length < 6) return toast.error("Enter a valid UTR / transaction ID");
    setSaving(true);
    const { error } = await supabase.from("orders").update({ utr: utr.trim(), status: "pending_verification" }).eq("id", order.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks! We're verifying your payment.");
    fetchOrder();
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl font-bold text-[var(--neon)]">{order.order_code}</h1>
            <div className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold ${s.color}`}>
            <SIcon className="h-4 w-4" /> {s.label}
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl bg-background/40 p-4 text-sm">
          <Row k="Product" v={order.product_name} />
          <Row k="Item" v={order.tier_label} />
          {order.player_name && <Row k="Player" v={order.player_name} />}
          {order.game_id && <Row k="Game UID" v={order.game_id} />}
          {order.server_id && <Row k="Server ID" v={order.server_id} />}
          {order.customer_email && <Row k="Email" v={order.customer_email} />}
          <Row k="Amount" v={order.currency === "INR" ? `₹${order.amount_inr}` : `$${order.amount_usd}`} bold />
          <Row k="Payment" v={(order.payment_method ?? (order.region === "IN" ? "UPI" : "Card")).toUpperCase()} />
          {order.utr && <Row k="UTR" v={order.utr} />}
          {order.completed_at && <Row k="Completed" v={new Date(order.completed_at).toLocaleString()} />}
          {order.admin_notes && <Row k="Notes" v={order.admin_notes} />}
        </div>

        {awaitingPayment && order.region === "IN" && (
          <div className="mt-6 rounded-xl border border-border bg-background/40 p-5">
            <h2 className="text-sm font-semibold">Pay with UPI</h2>
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
                    <button onClick={() => { navigator.clipboard.writeText(UPI_ID); toast.success("UPI copied"); }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px]"><Copy className="h-3 w-3" /> Copy</button>
                  </div>
                </div>
                <a href={upiLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]">
                  <Smartphone className="h-4 w-4" /> Pay ₹{order.amount_inr} with UPI
                </a>
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

        {(awaitingPayment || order.status === "pending_verification" || order.status === "awaiting_verification") && (
          <div className="mt-6 grid gap-5 rounded-xl border border-border bg-background/40 p-5 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold">Upload payment screenshot</h2>
              <p className="mt-1 text-xs text-muted-foreground">After paying, upload a screenshot. Admin will verify and complete your order.</p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadScreenshot(f); }} />
              <button disabled={uploading} onClick={() => fileRef.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--neon)]/40 bg-[var(--neon)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--neon)] hover:bg-[var(--neon)]/20 disabled:opacity-60">
                <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : order.screenshot_url ? "Replace screenshot" : "Upload screenshot"}
              </button>
              {shotPreview && (
                <a href={shotPreview} target="_blank" rel="noreferrer" className="mt-3 block">
                  <img src={shotPreview} alt="Payment screenshot" className="mt-2 max-h-48 w-auto rounded-lg border border-border" />
                </a>
              )}
            </div>
            <form onSubmit={submitUtr}>
              <h2 className="text-sm font-semibold">Or paste UTR / Transaction ID</h2>
              <p className="mt-1 text-xs text-muted-foreground">Optional — paste the 12-digit UPI UTR for faster verification.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 412598734201" className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm" />
                <button disabled={saving} className="rounded-xl bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {saving ? "Sending…" : "Submit UTR"}
                </button>
              </div>
            </form>
          </div>
        )}

        {(order.status === "completed" || order.status === "delivered") && (
          <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-5 text-sm text-success">
            🎉 Order successful — your top-up has been delivered. Enjoy the game!
          </div>
        )}

        {order.status === "rejected" && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
            ❌ Order rejected. {order.admin_notes ? `Reason: ${order.admin_notes}` : "Please contact support if this was a mistake."}
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
