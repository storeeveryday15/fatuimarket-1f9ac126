import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type Banner = {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  gradient: string;
  emoji: string;
};

const BANNERS: Banner[] = [
  {
    title: "MLBB Diamonds",
    subtitle: "Instant top-up with exclusive first-order discount",
    cta: "Top up now",
    href: "/products/mobile-legends",
    gradient: "from-fuchsia-600 via-purple-600 to-indigo-700",
    emoji: "💎",
  },
  {
    title: "WELCOME2FATUI",
    subtitle: "₹5 off your very first order — auto-applied at checkout",
    cta: "Claim offer",
    href: "#products",
    gradient: "from-emerald-500 via-teal-600 to-cyan-700",
    emoji: "🎁",
  },
  {
    title: "Free Fire Diamonds",
    subtitle: "Booyah faster with lightning-fast recharges",
    cta: "Recharge",
    href: "/products/free-fire",
    gradient: "from-orange-500 via-rose-500 to-red-600",
    emoji: "🔥",
  },
  {
    title: "Wallet Cashback",
    subtitle: "Earn up to ₹30 back on every completed order",
    cta: "See rewards",
    href: "/wallet",
    gradient: "from-amber-400 via-yellow-500 to-orange-500",
    emoji: "💰",
  },
];

export function BannerSlider() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % BANNERS.length), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-[var(--shadow-elegant)]">
      <div className="relative aspect-[21/9] sm:aspect-[3/1] w-full">
        {BANNERS.map((b, idx) => (
          <a
            key={b.title}
            href={b.href}
            className={`absolute inset-0 flex flex-col justify-center gap-3 bg-gradient-to-br ${b.gradient} p-6 sm:p-10 transition-opacity duration-700 ${idx === i ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div className="text-4xl sm:text-6xl">{b.emoji}</div>
            <h3 className="text-2xl sm:text-4xl font-bold text-white drop-shadow-md">{b.title}</h3>
            <p className="max-w-md text-sm sm:text-base text-white/90">{b.subtitle}</p>
            <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white backdrop-blur">
              {b.cta} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </a>
        ))}
      </div>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {BANNERS.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Go to slide ${idx + 1}`}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
