import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS } from "@/lib/products";
import { Zap, ShieldCheck, Clock, ArrowRight, Users } from "lucide-react";
import { LiveOrdersTicker } from "@/components/live-orders-ticker";
import { ReviewsList } from "@/components/reviews-list";
import { ReviewForm } from "@/components/review-form";
import { BannerSlider } from "@/components/banner-slider";
import { TopCustomers } from "@/components/top-customers";
import { OrderStats } from "@/components/order-stats";
import { RecentPurchases } from "@/components/recent-purchases";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fatui Market — Instant Game Top-Up & Digital Codes" },
      { name: "description", content: "Instant diamonds, UC, VP, Steam Wallet and Google Play codes. Trusted by gamers worldwide." },
      { property: "og:title", content: "Fatui Market — Instant Game Top-Up" },
      { property: "og:description", content: "Top up your favorite games in seconds." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div>
      {/* Hero carousel */}
      <section className="container mx-auto max-w-7xl px-4 pt-6 md:pt-10">
        <h1 className="sr-only">Fatui Market — Instant Game Top-Up</h1>
        <BannerSlider />

        {/* Feature strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface-card p-4">
              <f.icon className="h-5 w-5 text-[var(--neon)]" />
              <div className="mt-2 text-sm font-semibold">{f.title}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live orders ticker */}
      <section className="container mx-auto max-w-7xl px-4 pt-8">
        <LiveOrdersTicker />
      </section>

      {/* Real-time order stats */}
      <section className="container mx-auto max-w-7xl px-4 pt-8">
        <OrderStats />
      </section>

      {/* Top customers + recent purchases */}
      <section className="container mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          <TopCustomers />
          <RecentPurchases />
        </div>
      </section>

      {/* Products */}
      <section id="products" className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">Choose your game</h2>
            <p className="mt-2 text-muted-foreground">All top-ups delivered directly to your account.</p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => {
            const minInr = Math.min(
              ...p.denominations.map((d) => d.priceINR ?? Math.round(d.price * 83))
            );
            return (
              <Link
                key={p.slug}
                to="/products/$slug"
                params={{ slug: p.slug }}
                className="group surface-card relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={p.image}
                    alt={`${p.name} top-up card`}
                    loading="lazy"
                    className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  {/* Dark overlay 50% for readable text on any art */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
                    {p.publisher}
                  </span>
                  {/* Text overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="text-xl font-extrabold text-white drop-shadow-lg">{p.name}</h3>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--neon)]">
                      {p.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Starting from</div>
                    <div className="text-base font-bold text-foreground">₹{minInr}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform group-hover:translate-x-0.5">
                    Top Up <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto max-w-7xl px-4 pb-20">
        <div className="surface-card overflow-hidden">
          <div className="grid gap-0 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="border-b border-border p-8 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                <div className="text-xs font-mono text-[var(--neon)]">0{i + 1}</div>
                <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer reviews */}
      <section className="container mx-auto max-w-7xl px-4 pb-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">What customers say</h2>
            <p className="mt-2 text-muted-foreground">Real reviews from real gamers.</p>
          </div>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr,400px]">
          <ReviewsList limit={8} />
          <div>
            <h3 className="text-lg font-semibold">Share your experience</h3>
            <p className="mt-1 text-xs text-muted-foreground">Only your first name + last initial is shown publicly.</p>
            <div className="mt-3">
              <ReviewForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const FEATURES = [
  { icon: Zap, title: "Instant delivery", desc: "Most orders complete in under 60 seconds." },
  { icon: ShieldCheck, title: "Secure payments", desc: "PCI-compliant gateways and SSL." },
  { icon: Clock, title: "24/7 support", desc: "Real humans, real fast — any time." },
  { icon: Users, title: "Real customers", desc: "Verified reviews from actual buyers." },
];

const STEPS = [
  { title: "Pick your game", desc: "Choose from MLBB, Free Fire, PUBG, Valorant, Steam or Google Play." },
  { title: "Enter your ID", desc: "Provide your player ID or email for digital codes." },
  { title: "Pay & receive", desc: "Pay securely. Top-up lands in your account in seconds." },
];
