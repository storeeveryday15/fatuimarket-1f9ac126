The premium MLBB hero was already built in the previous turn inside `src/components/banner-slider.tsx` and mounted as the first section of the homepage. This plan verifies it matches every requirement in your latest brief and applies a few small polish tweaks — no rebuild.

## What already exists (verified against your brief)

- Slide 1 background: your uploaded MLBB wallpaper (`hero-mlbb.jpg` asset), no AI art.
- Full-width, 24px rounded corners (`rounded-3xl`), responsive heights (260px mobile → 500px desktop).
- Dark black→purple gradient overlay (~55%) + extra purple-950 top gradient for readability.
- Large "FATUI MARKET" watermark, bottom-right, ~12% opacity, white with blur/glow.
- Left content: 🛡 Trusted by Gamers badge, "MOBILE LEGENDS DIAMONDS" title, subtitle "Cheapest Weekly Pass • Starlight • Twilight Pass", feature row (⚡ Instant Delivery, 🛡 Safe & Secure, 🎧 24/7 Support), primary "Top Up Now →" (gradient glow) + secondary "Browse Top-ups".
- Carousel: Embla + Autoplay, 5s auto-advance, touch swipe + mouse drag, arrows, animated dots (active dot widens), infinite loop, pause on interaction, 8s resume timer.
- Animations: Ken Burns zoom on active slide, text slide-in from left (`hero-content-in`), button hover glow, smooth fade/slide transitions.
- Mobile: text centered, buttons scale to full width, 260px height preserved.
- Theme: black / purple / blue Fatui palette using existing design tokens.

## Small polish this plan will apply

1. **Dot animation** — add a subtle scale pulse to the active dot in addition to width growth (currently only width animates).
2. **Button hover glow** — strengthen the primary CTA's glow with a soft `box-shadow` transition (currently uses `--shadow-glow` only on rest state).
3. **Reduced-motion guard** — respect `prefers-reduced-motion` to disable Ken Burns and content slide-in for accessibility.
4. **Watermark tuning** — nudge opacity to 12% and add a slight `text-shadow` glow so it reads as premium at all sizes.
5. **Alt/ARIA sweep** — add descriptive `aria-label` on arrows ("Previous slide" / "Next slide") and confirm each slide's `aria-label` reads "1 of 3", etc.

## Technical notes

- Files touched: `src/components/banner-slider.tsx` (polish only), `src/styles.css` (reduced-motion + dot pulse keyframe).
- No new dependencies. No changes to `src/routes/index.tsx` — carousel is already the first section.
- No AI artwork generated; MLBB slide continues to use your uploaded wallpaper via the existing `.asset.json` pointer.

If you'd rather I leave it fully as-is (no polish), say the word and I'll close this out untouched.