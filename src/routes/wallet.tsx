import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownRight, RefreshCw, Gift, ShoppingBag, Copy, Smartphone, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { createWalletTopup, getWalletTopupState, submitWalletTopupUtr, type WalletTopupState } from "@/lib/wallet.functions";
import { buildUpiLink, UPI_ID, UPI_MERCHANT } from "@/lib/products";
import { safeCopy } from "@/lib/safe-browser";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [
    { title: "Wallet — Fatui Market" },
    { name: "description", content: "Top up your Fatui Market wallet and view transaction history." },
    { property: "og:title", content: "Wallet — Fatui Market" },
    { property: "og:description", content: "Secure Fatui Market wallet top-ups and transaction history." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: WalletPage,
});

const PRESETS = [50, 100, 200, 500, 1000];
type Tx = { id: string; type: string; amount_inr: number; description: string | null; created_at: string; order_id: string | null };

function WalletPage() {
  const { status, user } = useRequireAuth();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | "custom">(100);
  const [custom, setCustom] = useState("");
  const [processing, setProcessing] = useState(false);
  const [topup, setTopup] = useState<WalletTopupState | null>(null);
  const [utr, setUtr] = useState("");
  const [qr, setQr] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const createTopup = useServerFn(createWalletTopup);
  const getTopup = useServerFn(getWalletTopupState);
  const submitUtr = useServerFn(submitWalletTopupUtr);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: prof }, { data: tx }] = await Promise.all([
      supabase.from("profiles").select("wallet_balance").eq("id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("id,type,amount_inr,description,created_at,order_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setBalance(Number((prof as { wallet_balance?: number } | null)?.wallet_balance ?? 0));
    setTxns((tx ?? []) as Tx[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (status === "authed") void refresh(); }, [status, refresh]);
  useEffect(() => {
    if (!topup) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((new Date(topup.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [topup]);
  useEffect(() => {
    if (!topup || !["pending_payment", "pending_verification"].includes(topup.status)) return;
    const timer = setInterval(async () => {
      const next = await getTopup({ data: { topup_code: topup.topup_code } }).catch(() => null);
      if (!next) return;
      setTopup(next);
      if (next.status === "paid") { toast.success(`₹${next.amount_inr.toFixed(2)} added to your wallet`); void refresh(); }
    }, 7000);
    return () => clearInterval(timer);
  }, [getTopup, refresh, topup]);

  const amount = selected === "custom" ? Number(custom) : selected;
  const amountValid = Number.isInteger(amount) && amount >= 10 && amount <= 100000;
  const upiLink = useMemo(() => topup ? buildUpiLink(topup.amount_inr, `${topup.topup_code} Wallet`) : "", [topup]);
  useEffect(() => { if (upiLink) void QRCode.toDataURL(upiLink, { width: 240, margin: 1 }).then(setQr); }, [upiLink]);

  const beginTopup = async () => {
    if (!amountValid) return toast.error("Enter a whole amount between ₹10 and ₹1,00,000");
    setProcessing(true);
    try { setTopup(await createTopup({ data: { amount_inr: amount } })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not start top-up"); }
    finally { setProcessing(false); }
  };

  const sendReference = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!topup) return;
    setProcessing(true);
    try {
      const next = await submitUtr({ data: { topup_code: topup.topup_code, utr: utr.trim() } });
      setTopup(next);
      setUtr("");
      toast.success("Reference received — verification is automatic");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit reference"); }
    finally { setProcessing(false); }
  };

  if (status === "loading") return <div className="container mx-auto px-4 py-24 text-center text-sm text-muted-foreground">Loading wallet…</div>;
  if (status !== "authed") return null;

  return <div className="container mx-auto max-w-4xl px-4 py-10">
    <div className="mb-6 flex items-center justify-between"><div><h1 className="font-display text-2xl font-bold">Wallet</h1><p className="text-sm text-muted-foreground">Top up and pay faster on future orders.</p></div><button onClick={() => void refresh()} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button></div>
    <div className="surface-card overflow-hidden p-6 bg-[image:var(--gradient-primary)] text-primary-foreground"><div className="flex items-center gap-2 text-xs uppercase opacity-90"><WalletIcon className="h-4 w-4" /> Current balance</div><div className="mt-2 font-display text-4xl font-bold">₹{balance.toFixed(2)}</div></div>

    {!topup ? <section className="surface-card mt-6 p-5">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Top up wallet</h2>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">{PRESETS.map((p) => <button key={p} type="button" onClick={() => { setSelected(p); setCustom(""); }} className={`rounded-lg border px-3 py-3 text-sm font-semibold ${selected === p ? "border-[var(--neon)] bg-[var(--neon)]/10" : "border-border bg-background/40"}`}>₹{p}</button>)}</div>
      <label className="mt-4 block text-xs text-muted-foreground">Custom amount (min ₹10)</label>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-background/40 px-3"><span className="text-sm text-muted-foreground">₹</span><input type="number" inputMode="numeric" min={10} max={100000} step={1} value={custom} onChange={(e) => { setCustom(e.target.value); setSelected("custom"); }} placeholder="Enter amount" className="w-full bg-transparent px-2 py-2 text-sm outline-none" /></div>
      <button onClick={beginTopup} disabled={processing || !amountValid} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"><Plus className="h-4 w-4" />{processing ? "Starting…" : `Top up ₹${amountValid ? amount : "—"}`}</button>
      <p className="mt-2 text-[11px] text-muted-foreground">Pay by UPI, then enter the UTR/RRN for secure automatic verification.</p>
    </section> : <section className="surface-card mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Wallet top-up · ₹{topup.amount_inr}</h2><p className="font-mono text-xs text-muted-foreground">{topup.topup_code}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize">{topup.status.replaceAll("_", " ")}</span></div>
      {topup.status === "paid" ? <div className="mt-5 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">Payment verified and wallet credited.</div> : <>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning"><span className="inline-flex items-center gap-2 text-sm font-semibold"><Timer className="h-4 w-4" /> Complete payment within</span><span className="font-mono text-xl font-bold">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center"><div className="rounded-lg bg-white p-2">{qr && <img src={qr} alt="Wallet top-up UPI QR" width={210} height={210} />}</div><div className="space-y-3"><div><div className="text-xs text-muted-foreground">Pay exact amount</div><div className="text-3xl font-bold">₹{topup.amount_inr}</div></div><div className="rounded-lg border border-border p-3 text-sm"><div className="font-semibold">{UPI_MERCHANT}</div><div className="mt-1 flex items-center justify-between"><code>{UPI_ID}</code><button type="button" onClick={() => void safeCopy(UPI_ID).then((ok) => ok ? toast.success("UPI copied") : toast.error("Copy failed"))} className="inline-flex items-center gap-1"><Copy className="h-3 w-3" /> Copy</button></div></div>{secondsLeft > 0 && <a href={upiLink} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-semibold text-primary-foreground"><Smartphone className="h-4 w-4" /> Pay with UPI</a>}</div></div>
        <form onSubmit={sendReference} className="mt-5"><label className="text-sm font-semibold">UTR / RRN</label><p className="text-xs text-muted-foreground">Enter the reference from your payment app. No screenshot is needed.</p><div className="mt-2 flex gap-2"><input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 412598734201" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm" /><button disabled={processing} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{processing ? "Submitting…" : "Submit"}</button></div></form>
      </>}
      <button type="button" onClick={() => setTopup(null)} className="mt-4 text-xs text-muted-foreground hover:text-foreground">Start another top-up</button>
    </section>}

    <section className="surface-card mt-6 p-5"><h2 className="text-sm font-semibold uppercase text-muted-foreground">Transaction history</h2>{loading ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : txns.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No transactions yet.</p> : <ul className="mt-4 divide-y divide-border">{txns.map((tx) => <TxRow key={tx.id} tx={tx} />)}</ul>}</section>
  </div>;
}

function TxRow({ tx }: { tx: Tx }) {
  const positive = Number(tx.amount_inr) >= 0;
  const meta = typeMeta(tx.type);
  return <li className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-full ${meta.bg}`}><meta.Icon className={`h-4 w-4 ${meta.color}`} /></div><div><div className="text-sm font-medium capitalize">{meta.label}</div><div className="text-[11px] text-muted-foreground">{tx.description ?? "—"} · {new Date(tx.created_at).toLocaleString()}</div></div></div><div className={`text-sm font-semibold ${positive ? "text-success" : "text-destructive"}`}>{positive ? "+" : ""}₹{Number(tx.amount_inr).toFixed(2)}</div></li>;
}

function typeMeta(type: string) {
  switch (type) {
    case "topup": return { label: "Top-up", Icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" };
    case "cashback": return { label: "Cashback", Icon: Gift, color: "text-[var(--neon)]", bg: "bg-[var(--neon)]/10" };
    case "refund": return { label: "Refund", Icon: ArrowUpRight, color: "text-success", bg: "bg-success/10" };
    case "spend": case "purchase": return { label: "Purchase", Icon: ShoppingBag, color: "text-destructive", bg: "bg-destructive/10" };
    default: return { label: type, Icon: ArrowDownRight, color: "text-muted-foreground", bg: "bg-muted" };
  }
}