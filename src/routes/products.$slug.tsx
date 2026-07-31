import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PRODUCTS,
  getProduct,
  getINR,
  generateOrderCode,
  whatsappLinkFor,
  type Denomination,
  type Server,
} from "@/lib/products";
import { ArrowLeft, Check, Globe, ArrowRight, Copy, Share2, MessageCircle, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { z } from "zod";
import { ReviewForm } from "@/components/review-form";
import { ReviewsList } from "@/components/reviews-list";
import { notifyOrder } from "@/lib/notify-order";
import { useProductStock } from "@/hooks/use-product-stock";



export const Route = createFileRoute("/products/$slug")({
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product: product! };
  },
  head: ({ params }) => {
    const p = getProduct(params.slug);
    if (!p) return { meta: [{ title: "Not found" }] };
    const absImage = p.image.startsWith("http") ? p.image : `https://fatuimarket.lovable.app${p.image}`;
    const prices = p.denominations.map((d) => d.price);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    return {
      meta: [
        { title: `${p.name} Top-Up — Fatui Market` },
        { name: "description", content: `Buy ${p.name} ${p.currency.toLowerCase()} instantly. ${p.tagline}` },
        { property: "og:title", content: `${p.name} Top-Up — Fatui Market` },
        { property: "og:description", content: p.tagline },
        { property: "og:image", content: absImage },
      ],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          image: absImage,
          description: p.tagline,
          brand: {
            "@type": "Brand",
            name: p.publisher,
          },
          offers: {
            "@type": "AggregateOffer",
            lowPrice: low.toFixed(2),
            highPrice: high.toFixed(2),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        }),
      }],
    };
  },
  notFoundComponent: () => (
    <div className="container mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Product not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm text-[var(--neon)] hover:underline">Back to home</Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="container mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button onClick={() => reset()} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Try again</button>
    </div>
  ),
  component: ProductPage,
});

type Region = "IN" | "INT";

function useDetectedRegion(): [Region, (r: Region) => void] {
  const [region, setRegion] = useState<Region>("IN");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("fm_region") : null;
    if (stored === "IN" || stored === "INT") { setRegion(stored); return; }
    fetch("https://ipwho.is/?fields=country_code")
      .then((r) => r.json())
      .then((d: { country_code?: string }) => setRegion(d?.country_code === "IN" ? "IN" : "INT"))
      .catch(() => {});
  }, []);
  const update = (r: Region) => { setRegion(r); try { localStorage.setItem("fm_region", r); } catch {} };
  return [region, update];
}

const formSchema = z.object({
  player_name: z.string().trim().min(1, "Player name is required").max(60),
  game_id: z.string().trim().min(1, "Game UID is required").max(40),
  server_id: z.string().trim().max(20).optional(),
  email: z.string().trim().email("Valid email required").max(254),
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { status, user } = useRequireAuth();
  const navigate = useNavigate();
  const [region, setRegion] = useDetectedRegion();
  const [selected, setSelected] = useState<Denomination>(product.denominations[0]);
  const [qty, setQty] = useState(1);
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [zone, setZone] = useState("");
  const [serverRegion, setServerRegion] = useState<string>(product.servers?.[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [placing, setPlacing] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [hasUsedWelcome, setHasUsedWelcome] = useState(true);

  const isGiftCard = !product.needsPlayerId;
  const showEmailInput = isGiftCard || !user;

  useEffect(() => { if (user?.email) setEmail(user.email); }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("wallet_balance,has_used_welcome_offer").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        const p = data as { wallet_balance?: number; has_used_welcome_offer?: boolean } | null;
        setWalletBalance(Number(p?.wallet_balance ?? 0));
        setHasUsedWelcome(!!p?.has_used_welcome_offer);
      });
  }, [user]);

  const inrAmount = useMemo(() => getINR(selected) * qty, [selected, qty]);
  const usdAmount = useMemo(() => (selected.price * qty).toFixed(2), [selected, qty]);

  const discountInr = region === "IN" && couponApplied ? 5 : 0;
  const walletApplyInr = region === "IN" && useWallet ? Math.min(walletBalance, Math.max(inrAmount - discountInr, 0)) : 0;
  const finalInr = Math.max(inrAmount - discountInr - walletApplyInr, 0);

  const applyCoupon = () => {
    if (coupon.trim().toUpperCase() !== "WELCOME2FATUI") { toast.error("Invalid coupon"); return; }
    if (hasUsedWelcome) { toast.error("Welcome offer already used."); return; }
    if (region !== "IN") { toast.error("Coupon valid on INR orders only"); return; }
    setCouponApplied(true);
    toast.success("₹5 welcome discount applied");
  };

  const needsId = product.needsPlayerId;
  const needsZone = product.slug === "mobile-legends";
  const needsServer = !!product.needsServer && !!product.servers?.length;

  const filled = (() => {
    if (!playerName.trim()) return false;
    if (needsId && !playerId.trim()) return false;
    if (needsZone && !zone.trim()) return false;
    if (needsServer && !serverRegion) return false;
    if (showEmailInput && !email.trim()) return false;
    return true;
  })();

  const stockInfo = useProductStock(product.slug, selected.label);


  const copyUid = async () => {
    if (!playerId.trim()) return toast.error("Enter your UID first");
    try { await navigator.clipboard.writeText(playerId.trim()); toast.success("UID copied"); } catch { toast.error("Copy failed"); }
  };

  const shareProduct = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = { title: `${product.name} — Fatui Market`, text: product.tagline, url };
    try {
      const nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav && typeof nav.share === "function") {
        await nav.share(shareData);
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(url);
        toast.success("Product link copied");
      }
    } catch { /* user cancelled */ }
  };

  const whatsappUrl = whatsappLinkFor(
    `Hi Fatui Market, I want to buy ${product.name} — ${selected.label}${qty > 1 ? ` × ${qty}` : ""}.`
  );

  const continueToPayment = async () => {
    if (status !== "authed" || !user) {
      navigate({ to: "/auth", search: { redirect: `/products/${product.slug}` } });
      return;
    }
    const parsed = formSchema.safeParse({
      player_name: playerName,
      game_id: needsId ? playerId : "n/a",
      server_id: needsZone ? zone : undefined,
      email: email || user.email || "",
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setPlacing(true);
    try {
      const code = generateOrderCode();
      const game_id = needsId ? `${playerId.trim()}${needsZone ? ` (${zone.trim()})` : ""}` : null;
      const { error } = await supabase.from("orders").insert({
        order_code: code,
        user_id: user.id,
        customer_email: (email || user.email || "").trim(),
        customer_contact: null,
        game_id,
        server_id: needsZone ? zone.trim() : null,
        server_region: needsServer ? serverRegion : null,
        player_name: playerName.trim(),
        product_slug: product.slug,
        product_name: product.name,
        tier_label: qty > 1 ? `${selected.label} × ${qty}` : selected.label,
        amount_inr: region === "IN" ? finalInr : null,
        amount_usd: region !== "IN" ? Number(usdAmount) : null,
        currency: region === "IN" ? "INR" : "USD",
        region,
        payment_method: region === "IN" ? "upi" : "card",
        status: "pending_payment",
        coupon_code: couponApplied ? "WELCOME2FATUI" : null,
        discount_inr: discountInr,
        wallet_used_inr: walletApplyInr,
      } as never);
      if (error) throw error;
      void notifyOrder(code, "created");

      toast.success(`Order ${code} created!`);
      navigate({ to: "/orders/$code", params: { code } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not create order");
    } finally {
      setPlacing(false);
    }
  };

  if (status === "loading") {
    return <div className="container mx-auto px-4 py-24 text-center text-sm text-muted-foreground">Checking your session…</div>;
  }
  if (status !== "authed") return null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to all products
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <div className="surface-card overflow-hidden">
            <div className="relative h-48 md:h-64">
              <img src={product.image} alt={product.name} width={1200} height={900} decoding="async" fetchPriority="high" className="h-full w-full object-cover" />
              <div className={`absolute inset-0 bg-gradient-to-t ${product.accent} opacity-40 mix-blend-overlay`} />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
              <div className="absolute bottom-4 left-5">
                <span className="rounded-full bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">{product.publisher}</span>
                <h1 className="mt-2 text-3xl font-bold md:text-4xl">{product.name}</h1>
                <p className="text-sm text-muted-foreground">{product.tagline}</p>
              </div>
            </div>
          </div>

          <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Paying from</span>
              <span className="font-semibold">{region === "IN" ? "🇮🇳 India (INR)" : "🌍 International (USD)"}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRegion("IN")} className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium", region === "IN" ? "border-[var(--neon)] glow-ring" : "border-border hover:border-foreground/30")}>India / UPI</button>
              <button type="button" onClick={() => setRegion("INT")} className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium", region === "INT" ? "border-[var(--neon)] glow-ring" : "border-border hover:border-foreground/30")}>International</button>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); continueToPayment(); }} className="space-y-6">
            <section className="surface-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">1 · Your details</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Player name</label>
                  <input required value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="In-game name" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
                {needsId && (
                  <div className={needsZone ? "" : "md:col-span-2"}>
                    <label className="text-xs font-medium text-muted-foreground">{product.idLabel ?? "Game UID"}</label>
                    <div className="mt-1 flex gap-2">
                      <input required value={playerId} onChange={(e) => setPlayerId(e.target.value)} placeholder={product.idPlaceholder} className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                      <button type="button" onClick={copyUid} title="Copy UID" className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/60 px-3 text-xs hover:border-foreground/30">
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </button>
                    </div>
                  </div>
                )}
                {needsZone && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Zone / Server ID</label>
                    <input required value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. 2345" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                )}
                {needsServer && (
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Server / Region</label>
                    <select required value={serverRegion} onChange={(e) => setServerRegion(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring">
                      {product.servers!.map((s: Server) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {showEmailInput && (
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Delivery email</label>
                    <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                )}
                {!showEmailInput && user && (
                  <div className="md:col-span-2 rounded-lg border border-dashed border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                    Delivery email: <span className="font-medium text-foreground">{user.email}</span>
                  </div>
                )}
              </div>
            </section>

            {region === "IN" && (
              <section className="surface-card p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Offers &amp; wallet</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Coupon code</label>
                    <div className="mt-1 flex gap-2">
                      <input value={coupon} disabled={couponApplied || hasUsedWelcome} onChange={(e) => setCoupon(e.target.value)} placeholder={hasUsedWelcome ? "Welcome offer already used" : "WELCOME2FATUI"} className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-60" />
                      {couponApplied ? (
                        <button type="button" onClick={() => { setCouponApplied(false); setCoupon(""); }} className="rounded-lg border border-border px-3 py-2 text-xs">Remove</button>
                      ) : (
                        <button type="button" disabled={hasUsedWelcome} onClick={applyCoupon} className="rounded-lg bg-[image:var(--gradient-primary)] px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Apply</button>
                      )}
                    </div>
                    {couponApplied && <div className="mt-1 text-[11px] text-success">✓ ₹5 off applied</div>}
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                    <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--neon)]" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">Use wallet balance</div>
                        <div className="text-[11px] text-muted-foreground">Available: ₹{walletBalance.toFixed(2)}</div>
                      </div>
                      {useWallet && walletBalance < Math.max(inrAmount - discountInr, 0) && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-background/60 p-2 text-[11px]">
                          <span className="text-muted-foreground">
                            {walletBalance <= 0 ? "Your wallet is empty." : "Insufficient balance for full payment."}
                          </span>
                          <Link
                            to="/wallet"
                            className="inline-flex items-center gap-1 rounded-md bg-[image:var(--gradient-primary)] px-2 py-1 text-[11px] font-semibold text-primary-foreground"
                          >
                            <Plus className="h-3 w-3" /> Top up
                          </Link>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </section>
            )}

            <section className="surface-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">2 · Select {product.currency.toLowerCase()}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {product.denominations.map((d: Denomination) => {
                  const active = selected.id === d.id;
                  return (
                    <button type="button" key={d.id} onClick={() => setSelected(d)} className={cn("group relative rounded-xl border bg-background/40 p-4 text-left transition-all", active ? "border-[var(--neon)] glow-ring" : "border-border hover:border-foreground/30")}>
                      {d.bonus && <span className="absolute right-2 top-2 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">{d.bonus}</span>}
                      <div className="text-sm font-semibold">{d.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{region === "IN" ? `₹${getINR(d)}` : `$${d.price.toFixed(2)} USD`}</div>
                      {active && <Check className="absolute bottom-3 right-3 h-4 w-4 text-[var(--neon)]" />}
                    </button>
                  );
                })}
              </div>
              {stockInfo.tracked && stockInfo.label && (
                <div className={cn("mt-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold", stockInfo.soldOut ? "bg-destructive/15 text-destructive" : stockInfo.low ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>
                  {stockInfo.label}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-background/40 p-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Quantity</div>
                  <div className="text-[11px] text-muted-foreground">Multiple packs of the same tier</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:border-foreground/30" aria-label="Decrease">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2ch] text-center text-sm font-semibold">{qty}</span>
                  <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:border-foreground/30" aria-label="Increase">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </section>

            <section className="surface-card p-5 border border-dashed border-[var(--neon)]/40">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">3 · Continue to payment</h2>
              <p className="mt-2 text-sm text-muted-foreground">Payment QR is generated on the next step once your details are confirmed.</p>
              {!filled && <p className="mt-2 text-xs text-warning">Fill all required fields to continue.</p>}
            </section>
          </form>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface-card p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Order summary</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Product" value={product.name} />
              <Row label="Item" value={qty > 1 ? `${selected.label} × ${qty}` : selected.label} />
              <Row label="Player" value={playerName || "—"} />
              {needsId && <Row label={product.idLabel ?? "UID"} value={playerId || "—"} />}
              {needsZone && <Row label="Zone" value={zone || "—"} />}
              {needsServer && <Row label="Server" value={product.servers?.find((s: Server) => s.id === serverRegion)?.label ?? "—"} />}
              <Row label="Email" value={email || user?.email || "—"} />
              {region === "IN" && discountInr > 0 && <Row label="Coupon" value={`− ₹${discountInr}`} />}
              {region === "IN" && walletApplyInr > 0 && <Row label="Wallet" value={`− ₹${walletApplyInr.toFixed(2)}`} />}
              <div className="my-2 h-px bg-border" />
              <div className="flex items-end justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
                <span className="text-3xl font-bold gradient-text">{region === "IN" ? `₹${finalInr.toFixed(2)}` : `$${usdAmount}`}</span>
              </div>
            </div>

            <button type="button" disabled={placing || !filled || stockInfo.soldOut} onClick={continueToPayment} className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.01] disabled:opacity-50">
              {stockInfo.soldOut ? "Out of Stock" : placing ? "Creating order…" : <>Continue to payment <ArrowRight className="h-4 w-4" /></>}
            </button>


            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <button type="button" onClick={shareProduct} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-xs font-semibold hover:border-foreground/30">
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              By placing this order you agree to our <Link to="/terms" className="underline hover:text-foreground">Terms</Link> and <Link to="/refund" className="underline hover:text-foreground">Refund Policy</Link>.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {PRODUCTS.filter((p) => p.slug !== product.slug).slice(0, 3).map((p) => (
              <Link key={p.slug} to="/products/$slug" params={{ slug: p.slug }} className="surface-card overflow-hidden">
                <img src={p.image} alt={p.name} loading="lazy" decoding="async" width={400} height={400} className="aspect-square w-full object-cover" />
                <div className="p-2 text-[11px] font-medium">{p.name}</div>
              </Link>
            ))}
          </div>
        </aside>
      </div>

      <section className="mt-16 grid gap-8 lg:grid-cols-[1fr,400px]">
        <div>
          <h2 className="text-2xl font-bold">Customer reviews</h2>
          <p className="mt-1 text-sm text-muted-foreground">Real feedback from {product.name} buyers.</p>
          <div className="mt-5">
            <ReviewsListWithRefresh slug={product.slug} />
          </div>
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h3 className="text-lg font-semibold">Leave a review</h3>
          <p className="mt-1 text-xs text-muted-foreground">Only your first name + last initial is shown publicly.</p>
          <div className="mt-3">
            <ReviewFormWithRefresh slug={product.slug} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ReviewsListWithRefresh({ slug }: { slug: string }) {
  const [k, setK] = useState(0);
  // expose setter via a custom event to keep wiring local
  useEffect(() => {
    const handler = () => setK((v) => v + 1);
    window.addEventListener("fm:reviews:refresh", handler);
    return () => window.removeEventListener("fm:reviews:refresh", handler);
  }, []);
  return <ReviewsList productSlug={slug} refreshKey={k} />;
}

function ReviewFormWithRefresh({ slug }: { slug: string }) {
  return <ReviewForm productSlug={slug} onSubmitted={() => window.dispatchEvent(new Event("fm:reviews:refresh"))} />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium">{value}</span>
    </div>
  );
}
