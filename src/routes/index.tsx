import { createFileRoute } from "@tanstack/react-router";
import { Zap, ShieldCheck, Clock, Users } from "lucide-react";
import { LiveOrdersTicker } from "@/components/live-orders-ticker";
import { ReviewsList } from "@/components/reviews-list";
import { ReviewForm } from "@/components/review-form";
import { BannerSlider } from "@/components/banner-slider";
import { TopCustomers } from "@/components/top-customers";
import { OrderStats } from "@/components/order-stats";
import { RecentPurchases } from "@/components/recent-purchases";
import { ProductExplorer } from "@/components/product-explorer";
import { RecentlyViewedRail, RecommendedRail } from "@/components/product-rails";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fatui Market — Instant Game Top-Up & Digital Codes" },
      { name: "description", content: "Instant diamonds, UC, VP, Steam Wallet and Google Play codes. Trusted by gamers worldwide." },
      { property: "og:title", content: "Fatui Market — Instant Game Top-Up & Digital Codes" },
      { property: "og:description", content: "Instant diamonds, UC, VP, Steam Wallet and Google Play codes. Trusted by gamers worldwide." },
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

        <div className="mt-8">
          <ProductExplorer />
        </div>

        <div className="mt-14 space-y-12">
          <RecentlyViewedRail />
          <RecommendedRail />
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
