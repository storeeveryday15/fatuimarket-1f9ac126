
## Premium hero carousel (replaces current hero)

Scope: rebuild the homepage hero section into a full-width, 3-slide manual carousel. Changes are limited to `src/routes/index.tsx` (hero block) and `src/components/banner-slider.tsx` (rewritten). Nothing else on the site changes.

### 1. Assets (Lovable Assets, no binaries in repo)

Upload from `/mnt/user-uploads/`:

- MLBB wallpaper → `src/assets/hero-mlbb.jpg.asset.json` (fairy/elf skin art from prior upload)
- Genshin video → `src/assets/hero-genshin.mp4.asset.json` (screen recording)
- Wuthering Waves wallpaper → `src/assets/hero-wuwa.jpg.asset.json` (sky/clouds key art)

If any mapping is wrong, tell me before build.

### 2. Homepage hero surgery (`src/routes/index.tsx`)

Remove: current `<section>` hero (headline "Fatui Market", subtitle, "Browse top-ups / Contact support" buttons, 4-tile feature grid, `LiveOrdersTicker`, and current `<BannerSlider />` block).

Insert in its place: a single full-width section containing the new `<HeroCarousel />` component. Keep `heroBg` preload link in `head()` removed (no longer needed). Everything below the hero (products grid, how-it-works, reviews) is untouched. The 4 feature tiles (Instant delivery / Secure / 24/7 / Real customers) stay on the page but move directly under the hero as their own strip, matching your reference screenshot.

`LiveOrdersTicker` moves to just above the products grid so we don't lose it.

### 3. `<HeroCarousel />` — rewritten `banner-slider.tsx`

**Library**: use existing `embla-carousel-react` + add `embla-carousel-autoplay`. `bun add embla-carousel-autoplay`.

**Container**:
- `rounded-3xl` (24px), `overflow-hidden`, border `border-white/5`, `shadow-[var(--shadow-elegant)]`.
- Height: `h-[260px] sm:h-[340px] md:h-[440px] lg:h-[500px]`.
- Full-width inside the existing `container max-w-7xl` wrapper.

**Embla config**: `loop: true`, `duration: 30` (~500ms), `dragFree: false`. Autoplay plugin: 5000ms, `stopOnInteraction: false`, `stopOnMouseEnter: true`.

**Manual controls**:
- Left/right arrows: `absolute` at `left-3 / right-3`, vertically centered, glass pill `bg-black/40 backdrop-blur border border-white/10 hover:bg-black/60`, `h-10 w-10 md:h-12 md:w-12`, `ChevronLeft/Right` icons. Hidden on `<sm` (swipe only on tiny screens).
- Dots: bottom-center, tap to `api.scrollTo(i)`. Active dot animates to `w-8` with white fill + subtle glow; inactive `w-2 bg-white/40`. Transition 300ms.

**Autoplay pause + 8s resume**: any user gesture (pointerdown on slider, arrow click, dot click, hover on desktop) → `autoplay.stop()`. A single `setTimeout(8000)` (reset on each interaction) calls `autoplay.play()`. Hover-leave on desktop starts the 8s timer too.

**Slide media**:
- Slides 1 & 3 (MLBB, WuWa): `<img>` with `object-cover object-center`, `loading="lazy"` except slide 1 = `loading="eager" fetchPriority="high"`.
- Slide 2 (Genshin): `<video muted loop playsInline preload="metadata">`, `object-cover`. Play only when it's the selected snap; pause + `currentTime=0` otherwise (Embla `on('select')` listener).
- **Ken Burns**: each slide's media wrapper runs a slow `scale(1) → scale(1.08)` transform over 12s, restarted when the slide becomes active (key on active index). CSS keyframe `hero-kenburns`.

**Overlay**: on every slide, layer
`bg-gradient-to-r from-black/85 via-black/55 to-black/35`
plus a second layer
`bg-gradient-to-t from-purple-950/60 via-transparent to-transparent`
so the left half stays dark for text and the whole frame reads ~55% overlay.

**Watermark**: bottom-right, text `FATUI MARKET`, `text-2xl md:text-5xl font-black tracking-[0.32em] text-white/[0.12]`, `drop-shadow-[0_0_18px_rgba(168,85,247,0.35)]`, `blur-[0.4px]`, `pointer-events-none`.

**Transitions**: alongside Embla's slide, fade the incoming slide's content block from `opacity-0 translate-x-[-24px]` → `opacity-100 translate-x-0` over 500ms (keyed on `selectedScrollSnap`). Buttons: hover glow via `hover:shadow-[0_0_30px_rgba(168,85,247,0.55)]` transition.

### 4. Slide content layout

Two-column on `md+`, centered stack on mobile. Content sits inside a padded flex column with `max-w-xl`.

**Slide 1 — Mobile Legends** (per the detailed brief):
- Badge pill: `🛡 Trusted by Gamers` — small glass chip `bg-white/10 border border-white/15 backdrop-blur px-3 py-1 text-xs`.
- Title: two lines, `MOBILE LEGENDS` (white) then `DIAMONDS` with `gradient-text` class (existing purple→blue gradient). `text-3xl sm:text-5xl md:text-6xl font-black leading-[0.95] tracking-tight uppercase`.
- Subtitle: `Cheapest Weekly Pass • Starlight • Twilight Pass` — `text-sm md:text-base text-white/85 max-w-md`.
- Feature row: three inline chips `⚡ Instant Delivery`, `🛡 Safe & Secure`, `🎧 24/7 Support` — `text-xs md:text-sm text-white/90`, icon in `text-[var(--neon)]`. Wraps on mobile.
- Primary CTA: `Top Up Now →` — `Link` to `/products/mobile-legends`, `bg-[image:var(--gradient-primary)] text-primary-foreground rounded-xl px-5 py-3 font-semibold shadow-[var(--shadow-glow)] hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] hover:scale-[1.02] transition`.
- Secondary CTA: `Browse Top-ups` — anchor to `#products`, glass style `border border-white/20 bg-white/5 backdrop-blur text-white`.

**Slide 2 — Genshin Impact** (same layout structure):
- Badge: `✨ Featured`.
- Title: `GENESIS CRYSTALS` / `WELKIN MOON` (gradient on line 2).
- Subtitle: `Instant Delivery • UID Only`.
- Same feature row.
- Primary: `Recharge Now →` → `/products/genshin-impact`. Secondary: `Browse Top-ups` → `#products`.

**Slide 3 — Wuthering Waves**:
- Badge: `🔥 New Arrival`.
- Title: `WUTHERING WAVES` / `LUNITES` (gradient on line 2).
- Subtitle: `Fast Delivery • Best Price`.
- Same feature row.
- Primary: `Buy Now →` → `/products/wuthering-waves`. Secondary: `Browse Top-ups` → `#products`.

**Mobile**: text column centers (`text-center items-center`), CTAs go full-width in a vertical stack, arrows stay visible from `sm+`.

### 5. Accessibility & perf

- Arrow buttons: `aria-label="Previous slide" / "Next slide"`, dots: `aria-label="Go to slide N"` with `aria-current` on active.
- `role="region" aria-roledescription="carousel" aria-label="Featured top-ups"` on the container.
- Non-active slides get `aria-hidden="true"` and their `<Link>`s `tabIndex={-1}` so keyboard focus doesn't leak into hidden slides.
- `prefers-reduced-motion: reduce` → disable Ken Burns + autoplay.
- Lazy-load slides 2 & 3 images; video `preload="metadata"`; first slide eager.

### Out of scope

Products, wallet, admin, auth, product page — no changes. `LiveOrdersTicker` is only relocated, not modified.
