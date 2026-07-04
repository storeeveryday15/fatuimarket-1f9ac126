## Plan: Update Genshin Impact Product Image

### What we're changing
Replace the current Genshin Impact product card/hero image with the uploaded Sandrone Event Wish Preview image (`show.png`). The banner slider on the homepage remains untouched.

### Steps
1. Create a CDN asset from `user-uploads://show.png` → `src/assets/game-genshin.png.asset.json`
2. Update `src/lib/products.ts`: change the Genshin Impact product's `image` field from the old `game-genshin.jpg.asset.json` to the new `game-genshin.png.asset.json`

### What stays the same
- Homepage banner slider (hero-genshin.mp4 and banner-genshin.jpg)
- All other product images
- Product data (prices, servers, name, etc.)