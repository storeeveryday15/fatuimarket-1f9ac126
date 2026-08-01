/**
 * Public knowledge base for the Fatui AI assistant.
 *
 * Everything in this file is customer-facing information only. It must never
 * contain supplier costs, admin notes, secrets or private customer data.
 */

export const STORE_POLICY = `
FATUI MARKET — STORE HANDBOOK (public information)

WHAT WE ARE
Fatui Market is an instant game top-up store. We sell in-game currency, passes,
gift cards and wallet codes for popular mobile, PC and console games. Orders are
fulfilled by our team through official publisher and authorised reseller channels.

HOW ORDERING WORKS
1. Pick a game on the storefront (or from /buy).
2. Choose a pack / denomination.
3. Enter the account details the game needs (player ID, server/region, or email
   for gift-card style products).
4. Choose a payment method and pay.
5. Submit the payment reference (UTR) if you paid by UPI, or complete the card /
   netbanking flow.
6. We verify and deliver. You can follow the order live on the order page.

DELIVERY TIME
Most top-ups are delivered in 1–15 minutes after payment verification, and very
often under 60 seconds. Gift-card and code products are delivered to the order
page and email. During publisher maintenance or very high demand it can take up
to a few hours; the order page always shows the current status.

IS IT SAFE
Yes. We never ask for your game account password, OTP or login credentials — only
the public player/user ID and server. Payments run through Razorpay (cards, UPI,
netbanking) or direct UPI. We do not store card details.

PAYMENT METHODS
- India: UPI (QR or UPI ID), cards, netbanking and wallets through Razorpay.
- International: card payments in USD.
- Fatui Wallet balance can be used on any order, alone or combined with another
  method.

WALLET
Every signed-in customer has a Fatui Wallet at /wallet. You can top it up with
any payment method and spend it instantly on future orders. Completed orders
earn automatic cashback that lands in the wallet. Wallet balance is store credit
and is not withdrawable to a bank account.

COUPONS
Coupon codes are entered on the product page before checkout. One coupon per
order; coupons cannot be combined with each other but can be combined with
wallet balance. Expired or game-specific coupons will be rejected at checkout.

ORDER TRACKING
Every order gets a code that starts with FM-. Track it at /track or open
/orders/<code>. Signed-in customers also see all their orders in the dashboard
and get inbox notifications on every status change.

REFUND POLICY
- Full refund if the order has not been delivered yet and you cancel, or if we
  cannot fulfil it.
- Wrong player ID or wrong server entered by the customer cannot be refunded
  once the top-up has been delivered to that account — publishers cannot reverse it.
- Failed payments that were debited are refunded to the original method,
  typically within 5–7 working days.
- Full policy: /refund

LOGIN
Sign in at /auth with email. A 6-digit code is emailed to you; there is no
password to remember. Guest checkout is possible, but signing in unlocks the
wallet, cashback, order history and the notification inbox.

SUPPORT
- Live chat: this assistant, plus the support form at /contact
- WhatsApp, Telegram and Instagram links are in the floating support menu
- Business hours: 9:00 AM – 2:00 AM IST, every day. Orders are processed
  automatically outside those hours too, and anything unusual is handled when
  the team is back online.

INTERNATIONAL PAYMENTS
Customers outside India are billed in USD by card. Your bank may add a foreign
transaction fee — that fee comes from the bank, not from us. UPI is India-only.

WHY PRICES CHANGE
Top-up prices follow publisher pricing, currency rates and regional taxes, so a
pack can cost slightly more or less than last week. The price shown at checkout
is the final price you pay — there are no hidden fees.

STOCK STATES
Products can show OUT OF STOCK, LIMITED STOCK, RESTOCKING, COMING SOON or
UNAVAILABLE. These are live: a blocked product cannot be purchased until it is
restocked, and it becomes buyable again automatically.
`.trim();

type GameGuide = {
  needs: string;
  servers: string;
  delivery: string;
  issues: string;
};

/** Per-game top-up guidance, keyed by product slug. */
export const GAME_GUIDES: Record<string, GameGuide> = {
  "mobile-legends": {
    needs: "User ID and Zone ID. Both are shown in-game under Profile — the number in brackets is the Zone ID (for example 12345678 (2001)).",
    servers: "MLBB has no region dropdown here; the Zone ID identifies the server.",
    delivery: "Diamonds usually land in under 5 minutes and appear directly in the account.",
    issues: "Most failures are a mistyped Zone ID. Weekly Diamond Pass and Twilight Pass are account-bound and cannot be gifted.",
  },
  "genshin-impact": {
    needs: "9-digit UID plus the server the UID belongs to.",
    servers: "Asia, America, Europe, TW/HK/MO.",
    delivery: "Genesis Crystals are credited in minutes. Welkin Moon and Battle Pass activate immediately.",
    issues: "A UID entered with the wrong server cannot be topped up. The first-time double Genesis Crystal bonus applies once per pack per account.",
  },
  "wuthering-waves": {
    needs: "UID plus the server region.",
    servers: "SEA, Asia, America, Europe, HMT.",
    delivery: "Lunites and Lunite Subscription are credited within minutes.",
    issues: "Rewards from the Lunite Subscription must be claimed daily in-game; we only deliver the purchase.",
  },
  "love-and-deepspace": {
    needs: "UID plus the server region.",
    servers: "Asia, America, Europe.",
    delivery: "Diamonds are credited within minutes.",
    issues: "Some limited-time packs are once-per-account and will fail if already purchased.",
  },
  "honor-of-kings": {
    needs: "Player ID (Open ID) as shown in your in-game profile.",
    servers: "Global server. Chinese-server accounts are not supported.",
    delivery: "Tokens/Vouchers are credited within minutes.",
    issues: "Make sure you are on the Global (international) version, not the CN version.",
  },
  "pubg-mobile": {
    needs: "Numeric Character ID from your in-game profile.",
    servers: "Global account, no region selection needed for UC.",
    delivery: "UC is credited within minutes; Royale Pass is activated on the account.",
    issues: "Korean/Vietnamese/Taiwan regional builds use separate stores and are not supported.",
  },
  valorant: {
    needs: "Riot ID including the tagline (for example Player#NA1) and the region.",
    servers: "Region matters for Riot accounts — pick the one your account was created in.",
    delivery: "VP is credited within minutes once the Riot ID is verified.",
    issues: "Riot IDs are case-sensitive and change when you rename; give us the current one.",
  },
  "free-fire": {
    needs: "Free Fire Player ID.",
    servers: "Global; the player ID resolves the region.",
    delivery: "Diamonds are credited within minutes.",
    issues: "Weekly/Monthly membership rewards must be claimed in-game each day.",
  },
  "steam-wallet": {
    needs: "Just your email — this is a code product, not an account top-up.",
    servers: "Codes are region-locked; buy the region that matches your Steam account country.",
    delivery: "The code is delivered to the order page and your email.",
    issues: "A code redeemed on the wrong region account will be rejected by Steam, so check the region before buying.",
  },
  "google-play": {
    needs: "Your email — a gift code is delivered to you.",
    servers: "Region-locked to the Play account country.",
    delivery: "Delivered to the order page and email.",
    issues: "Google Play codes cannot be used for purchases outside their country.",
  },
  "razer-gold": {
    needs: "Your email, or your Razer Gold account ID for direct top-ups.",
    servers: "Global / regional pins depending on the pack.",
    delivery: "PIN is delivered to the order page and email.",
    issues: "Razer Gold PINs can only be redeemed once and are non-refundable after reveal.",
  },
  roblox: {
    needs: "Roblox username (exact spelling).",
    servers: "Global.",
    delivery: "Robux are credited within minutes, or a gift card code is delivered for card packs.",
    issues: "Robux bought via gift card go to the account that redeems the code, so redeem it yourself.",
  },
};
