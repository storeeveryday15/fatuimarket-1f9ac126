import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Zap, ShieldCheck, Headphones } from "lucide-react";
import mlbb from "@/assets/hero-mlbb.jpg.asset.json";
import genshin from "@/assets/hero-genshin.mp4.asset.json";
import wuwa from "@/assets/hero-wuwa.jpg.asset.json";

type Slide = {
  key: string;
  badge: string;
  titleTop: string;
  titleBottom: string;
  subtitle: string;
  primary: { label: string; to: string };
  media: { kind: "image"; src: string } | { kind: "video"; src: string };
};

const SLIDES: Slide[] = [
  {
    key: "mlbb",
    badge: "🛡 Trusted by Gamers",
    titleTop: "MOBILE LEGENDS",
    titleBottom: "DIAMONDS",
    subtitle: "Cheapest Weekly Pass • Starlight • Twilight Pass",
    primary: { label: "Top Up Now", to: "/products/mobile-legends" },
    media: { kind: "image", src: mlbb.url },
  },
  {
    key: "genshin",
    badge: "✨ Featured",
    titleTop: "GENESIS CRYSTALS",
    titleBottom: "WELKIN MOON",
    subtitle: "Instant Delivery • UID Only",
    primary: { label: "Recharge Now", to: "/products/genshin-impact" },
    media: { kind: "video", src: genshin.url },
  },
  {
    key: "wuwa",
    badge: "🔥 New Arrival",
    titleTop: "WUTHERING WAVES",
    titleBottom: "LUNITES",
    subtitle: "Fast Delivery • Best Price",
    primary: { label: "Buy Now", to: "/products/wuthering-waves" },
    media: { kind: "image", src: wuwa.url },
  },
];

export function BannerSlider() {
  const autoplay = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }),
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: 30, dragFree: false },
    [autoplay.current],
  );
  const [selected, setSelected] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    setSelected(idx);
    // manage video playback
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === idx) {
        v.play().catch(() => {});
      } else {
        v.pause();
        try { v.currentTime = 0; } catch {}
      }
    });
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scheduleResume = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    autoplay.current.stop();
    resumeTimer.current = setTimeout(() => {
      autoplay.current.play();
    }, 8000);
  }, []);

  const scrollTo = useCallback(
    (i: number) => {
      emblaApi?.scrollTo(i);
      scheduleResume();
    },
    [emblaApi, scheduleResume],
  );

  const prev = useCallback(() => {
    emblaApi?.scrollPrev();
    scheduleResume();
  }, [emblaApi, scheduleResume]);

  const next = useCallback(() => {
    emblaApi?.scrollNext();
    scheduleResume();
  }, [emblaApi, scheduleResume]);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured top-ups"
      className="relative overflow-hidden rounded-3xl border border-white/5 bg-black shadow-[var(--shadow-elegant)]"
      onPointerDown={scheduleResume}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {SLIDES.map((s, i) => {
            const isActive = selected === i;
            return (
              <div
                key={s.key}
                className="relative min-w-0 flex-[0_0_100%] h-[260px] sm:h-[340px] md:h-[440px] lg:h-[500px]"
                aria-hidden={!isActive}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${SLIDES.length}`}
              >
                {/* Media */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className={isActive ? "absolute inset-0 hero-kenburns" : "absolute inset-0"}>
                    {s.media.kind === "image" ? (
                      <img
                        src={s.media.src}
                        alt=""
                        loading={i === 0 ? "eager" : "lazy"}
                        {...(i === 0 ? { fetchPriority: "high" as const } : {})}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <video
                        ref={(el) => { videoRefs.current[i] = el; }}
                        src={s.media.src}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover object-center"
                      />
                    )}
                  </div>
                </div>

                {/* Overlays */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/35" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-purple-950/60 via-transparent to-transparent" />

                {/* Content */}
                <div className="relative h-full">
                  <div
                    key={isActive ? `${s.key}-in` : `${s.key}-out`}
                    className={`flex h-full max-w-xl flex-col justify-center gap-3 px-5 py-6 sm:gap-4 sm:px-8 md:px-12 md:py-10 text-center md:text-left items-center md:items-start ${isActive ? "hero-content-in" : "opacity-0"}`}
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] sm:text-xs font-medium text-white backdrop-blur">
                      {s.badge}
                    </span>
                    <h2 className="font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)] text-3xl sm:text-5xl md:text-6xl">
                      <span className="block">{s.titleTop}</span>
                      <span className="block gradient-text">{s.titleBottom}</span>
                    </h2>
                    <p className="max-w-md text-xs sm:text-sm md:text-base text-white/85">
                      {s.subtitle}
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1.5 text-[11px] sm:text-xs md:text-sm text-white/90">
                      <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-[var(--neon)]" /> Instant Delivery</span>
                      <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[var(--neon)]" /> Safe & Secure</span>
                      <span className="inline-flex items-center gap-1.5"><Headphones className="h-3.5 w-3.5 text-[var(--neon)]" /> 24/7 Support</span>
                    </div>
                    <div className="mt-1 flex w-full flex-col sm:w-auto sm:flex-row gap-2.5 sm:gap-3">
                      <Link
                        to={s.primary.to}
                        tabIndex={isActive ? 0 : -1}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)]"
                      >
                        {s.primary.label} <ArrowRight className="h-4 w-4" />
                      </Link>
                      <a
                        href="#products"
                        tabIndex={isActive ? 0 : -1}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
                      >
                        Browse Top-ups
                      </a>
                    </div>
                  </div>
                </div>

                {/* Watermark */}
                <div className="pointer-events-none absolute bottom-3 right-4 sm:bottom-5 sm:right-6">
                  <span
                    className="select-none font-black uppercase tracking-[0.32em] text-white/[0.13] text-lg sm:text-2xl md:text-4xl lg:text-5xl"
                    style={{ filter: "blur(0.4px) drop-shadow(0 0 18px rgba(168,85,247,0.35))" }}
                  >
                    FATUI MARKET
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 hidden sm:inline-flex -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 h-10 w-10 md:h-12 md:w-12"
      >
        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 hidden sm:inline-flex -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 h-10 w-10 md:h-12 md:w-12"
      >
        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {SLIDES.map((s, i) => {
          const active = i === selected;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={active}
              className={`h-2 rounded-full transition-all duration-300 ${active ? "w-8 bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]" : "w-2 bg-white/40 hover:bg-white/70"}`}
            />
          );
        })}
      </div>
    </div>
  );
}
