## Phase 1 — Product catalog overhaul

Scope for this phase: rebuild the product data + product-page UX. Homepage sections (Best Sellers, Hot Deals, FAQ page, announcements, search bar, etc.) come in Phase 2. All existing systems stay intact — auth, Supabase, orders, wallet, cashback, admin, WhatsApp, UPI/PayPal region logic, reviews, tracking.

### 1. Rewrite `src/lib/products.ts`

Replace the `PRODUCTS` array with the 10 categories, in this order:

1. Mobile Legends (replace all denominations with your new list — 3D through 706D, WP variants, Weekly Elite, Twilight, Starlight, Starlight+)
2. Wuthering Waves (Lunites packs + Lunite Subscription)
3. Genshin Impact (Genesis Crystals + Welkin Moon)
4. Free Fire (updated pricing you provided — replaces current FF list)
5. Love and Deepspace (Crystals + Aurum Pass + Companionship Pack)
6. Honor of Kings (Tokens + Weekly Card + Weekly Card Plus)
7. PUBG Mobile (kept as-is per your answer)
8. Valorant (kept as-is)
9. Steam Wallet (kept as-is)
10. Google Play Gift Cards (INR denominations ₹30 → ₹5000)
11. Razer Gold Cards (all 18 USD denominations with your exact INR prices)

Extend the `Product` type with:
- `needsServer?: boolean`
- `servers?: { id: string; label: string }[]`

Server lists:
- **Genshin**: Asia, America, Europe, TW/HK/MO
- **Wuthering Waves**: SEA, Asia, America, Europe, HMT
- **Love and Deepspace**: Asia, America, Europe
- **Honor of Kings**: single global (no selector)

MLBB stays on Zone ID (existing behavior). Google Play + Razer Gold + Steam = no player ID.

### 2. Product page updates (`src/routes/products.$slug.tsx`)

Add on top of existing flow:
- **Server selector** (dropdown) when `product.needsServer` — required before Buy Now, saved into the order row (new column `server_region` on `orders`).
- **Quantity selector** (1–10) that multiplies the selected pack price for the order summary + UPI QR amount.
- **Copy UID** button next to the UID input (uses `navigator.clipboard`).
- **Share Product** button (Web Share API with URL fallback to copy link).
- **Contact on WhatsApp** button (prefilled message with product name + selected pack) alongside the existing Buy Now.
- Keep the existing 2-step checkout, dynamic UPI QR, PayPal/card placeholder for non-IN, screenshot upload, cashback + coupon logic — untouched.

### 3. Homepage grid (`src/routes/index.tsx`)

Only change: the product grid renders the new 10 (+PUBG) categories automatically from `PRODUCTS`. No other homepage sections changed in this phase.

### 4. Database

One migration adding `server_region TEXT` to `public.orders` (nullable, no policy change).

### 5. Admin + dashboard

Show `server_region` in the admin order table and the customer's order detail view (read-only). No workflow changes.

### Out of scope (deferred to Phase 2)

Animated hero banner rebuild, search bar, Best Sellers carousel, Hot Deals, Recently Updated Prices, Announcements, FAQ page, wallet cashback banner refresh, loading animations pass. Refund/Terms/Privacy pages already exist and stay.

### Technical notes

- All prices stored as explicit `priceINR` + `price` (USD) on each denomination, matching current schema.
- Razer/Google Play items use `needsPlayerId: false` and deliver as codes (existing Steam-style flow).
- Product images: reuse existing MLBB/FF/PUBG/Valorant/Steam/Google Play images; generate 4 new hero images for Wuthering Waves, Genshin, Love and Deepspace, Honor of Kings, Razer Gold via imagegen.
