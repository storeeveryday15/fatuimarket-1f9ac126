import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS } from "@/lib/products";
import heroBg from "@/assets/hero-bg.jpg";
import { Zap, ShieldCheck, Clock, Headphones, ArrowRight, Sparkles } from "lucide-react";
import { LiveOrdersTicker } from "@/components/live-orders-ticker";
import { ReviewsList } from "@/components/reviews-list";
import { ReviewForm } from "@/components/review-form";

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
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={heroBg}
          alt=""
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover opacity-50 dark:opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="container relative mx-auto max-w-7xl px-4 py-24 md:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[var(--neon)]" />
            Trusted by 50,000+ gamers
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Fatui <span className="gradient-text">Market</span>
            <br />
            top up in seconds.
          </h1>

          {/* Blurred live orders ticker */}
          <LiveOrdersTicker />

          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Instant delivery for Mobile Legends, Free Fire, PUBG, Valorant, Steam Wallet and Google Play. Pay with UPI (India) or Card / PayPal (international).
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#products"
              className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.02]"
            >
              Browse top-ups <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur hover:bg-secondary"
            >
              Contact support
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="surface-card p-4">
                <f.icon className="h-5 w-5 text-[var(--neon)]" />
                <div className="mt-2 text-sm font-semibold">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="container mx-auto max-w-7xl px-4 py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">Choose your game</h2>
            <p className="mt-2 text-muted-foreground">All top-ups delivered directly to your account.</p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <Link
              key={p.slug}
              to="/products/$slug"
              params={{ slug: p.slug }}
              className="group surface-card relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${p.accent} opacity-30 mix-blend-overlay`} />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                  {p.publisher}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <span className="text-xs font-medium text-[var(--neon)]">{p.currency}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">From ${Math.min(...p.denominations.map(d => d.price)).toFixed(2)}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                    Top up <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
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
  { icon: Clock, title: "24/7 availability", desc: "Top up anytime, day or night." },
  { icon: Headphones, title: "WhatsApp support", desc: "Real humans, real fast." },
];

const STEPS = [
  { title: "Pick your game", desc: "Choose from MLBB, Free Fire, PUBG, Valorant, Steam or Google Play." },
  { title: "Enter your ID", desc: "Provide your player ID or email for digital codes." },
  { title: "Pay & receive", desc: "Pay securely. Top-up lands in your account in seconds." },
];
