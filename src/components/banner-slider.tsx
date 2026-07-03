import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import mlbbSanrio from "@/assets/banner-mlbb-sanrio.jpg.asset.json";
import genshin from "@/assets/banner-genshin.jpg.asset.json";

type Banner = {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  gradient: string;
  emoji: string;
  image?: string;
};

const BANNERS: Banner[] = [
  {
    title: "MLBB × Sanrio Skins",
    subtitle: "Grab the comeback show skins with instant diamond top-up",
    cta: "Top up MLBB",
    href: "/products/mobile-legends",
    gradient: "from-fuchsia-600/70 via-purple-700/60 to-indigo-900/70",
    emoji: "💎",
    image: mlbbSanrio.url,
  },
  {
    title: "Genshin Impact Genesis",
    subtitle: "Recharge Genesis Crystals — UPI & PayPal accepted",
    cta: "Recharge Genshin",
    href: "/guides/genshin-impact-top-up",
    gradient: "from-emerald-700/60 via-teal-800/50 to-slate-900/70",
    emoji: "🌿",
    image: genshin.url,
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
            className={`absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {b.image && (
              <img
                src={b.image}
                alt={b.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading={idx === 0 ? "eager" : "lazy"}
              />
            )}
            <div className={`absolute inset-0 bg-gradient-to-br ${b.gradient}`} />
            {b.image && <div className="absolute inset-0 bg-black/30" />}
            <div className="relative flex h-full flex-col justify-center gap-3 p-6 sm:p-10">
              <div className="text-4xl sm:text-6xl drop-shadow-lg">{b.emoji}</div>
              <h3 className="text-2xl sm:text-4xl font-bold text-white drop-shadow-md">{b.title}</h3>
              <p className="max-w-md text-sm sm:text-base text-white/90 drop-shadow">{b.subtitle}</p>
              <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white backdrop-blur">
                {b.cta} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
            {/* Watermark */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="select-none text-4xl sm:text-7xl font-black uppercase tracking-widest text-white/10 rotate-[-18deg]">
                Fatui Market
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-white/70">
              © Fatui Market
            </div>
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
