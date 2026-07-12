// SEO landing page content. Each entry powers /buy/$slug.
// Keep content original, useful, and human-first — no keyword stuffing.

export type FAQ = { q: string; a: string };
export type TableRow = { pack: string; price: string; note?: string };
export type SeoSection = { h2: string; body: string[] }; // paragraphs
export type RelatedLink = { label: string; to: string };

export type SeoLanding = {
  slug: string;
  title: string; // <60 chars
  description: string; // <160 chars
  h1: string;
  intro: string;
  productSlug?: string; // link to /products/[slug] CTA
  image?: string; // absolute or path
  imageAlt?: string;
  breadcrumb: string;
  sections: SeoSection[];
  table?: { caption: string; rows: TableRow[] };
  buyingGuide: string[];
  safety: string[];
  faqs: FAQ[];
  related: RelatedLink[];
  keywords: string[];
};

const BASE = "https://fatuimarket.lovable.app";
export const seoBaseUrl = BASE;

export const SEO_LANDINGS: SeoLanding[] = [
  // ============================================================
  // PRODUCT LANDING PAGES
  // ============================================================
  {
    slug: "mobile-legends-diamonds",
    title: "Buy Mobile Legends Diamonds in India — Fatui Market",
    description:
      "Instant Mobile Legends diamond top-up in India. UPI, cards, wallet. Weekly Pass, Twilight, Starlight. Delivery in minutes. 24/7 support.",
    h1: "Mobile Legends Diamonds & Weekly Pass — Instant Top-Up in India",
    intro:
      "Fatui Market gives Mobile Legends: Bang Bang players a fast, safe and affordable way to top up diamonds and passes using your MLBB User ID. Pay with UPI, card, netbanking, or wallet balance in INR and get diamonds credited to your account in minutes.",
    productSlug: "mobile-legends",
    breadcrumb: "Mobile Legends Diamonds",
    keywords: [
      "Buy Mobile Legends Diamonds Cheap",
      "MLBB Weekly Pass India",
      "Cheapest MLBB Diamonds under ₹150",
      "Mobile Legends Recharge India",
      "Instant Mobile Legends Top-Up India",
    ],
    sections: [
      {
        h2: "Why players choose Fatui Market for MLBB top-ups",
        body: [
          "Mobile Legends diamonds are the currency you spend on skins, heroes, emblems, magic wheel spins and the Weekly Pass. Buying them through Fatui Market means you keep control of your account — we never ask for your Moonton password. You give us your MLBB User ID and Zone ID, and we credit diamonds directly through official channels.",
          "We serve players across India with UPI checkout in INR, live rate tracking, and multiple pack sizes from 3 diamonds up to 706 diamonds and Starlight Plus. Every order gets a unique tracking code (FM-XXXXXX) so you always know its status.",
        ],
      },
      {
        h2: "MLBB packs and current prices",
        body: [
          "Small packs are ideal if you just need enough diamonds to grab the Weekly Diamond Pass or a specific bundle. Larger packs give you buffer for magic wheel pulls, collector skins and events. If you play daily, Starlight and Starlight Plus give the best long-term value.",
        ],
      },
      {
        h2: "Cheapest MLBB diamonds under ₹150",
        body: [
          "Looking for the cheapest Mobile Legends diamond top-up under ₹150? The 86 Diamond pack sits right in that price range and is enough for a single Weekly Diamond Pass claim. The Weekly Pass itself is also priced below ₹150 and gives you 200+ diamonds worth of rewards over 7 days.",
          "For players who want to stack value on a small budget, combining a Weekly Pass with 22 or 55 diamonds keeps the total spend low while unlocking daily Pass rewards.",
        ],
      },
      {
        h2: "Weekly Pass, Twilight Pass and Starlight explained",
        body: [
          "The MLBB Weekly Diamond Pass is a 7-day pass that gives you daily diamond rewards, effectively multiplying your top-up. The Twilight Pass unlocks the season's exclusive skin line and additional Twilight Orbs. Starlight and Starlight Plus are the monthly subscriptions — Plus adds a guaranteed skin plus premium emotes and profile items.",
        ],
      },
    ],
    table: {
      caption: "Popular MLBB packs on Fatui Market",
      rows: [
        { pack: "86 Diamonds", price: "₹124", note: "Under ₹150" },
        { pack: "Weekly Pass", price: "₹148", note: "7-day rewards" },
        { pack: "172 Diamonds", price: "₹243" },
        { pack: "257 Diamonds", price: "₹349" },
        { pack: "Starlight (Monthly)", price: "₹467" },
        { pack: "706 Diamonds", price: "₹946" },
        { pack: "Starlight Plus", price: "₹1,166" },
      ],
    },
    buyingGuide: [
      "Open Mobile Legends → tap your avatar → your User ID and Zone ID (in brackets) are shown at the top.",
      "Choose your diamond pack or pass on our Mobile Legends product page.",
      "Enter your User ID and Zone ID exactly as shown in-game.",
      "Pay with UPI, card, netbanking, or wallet balance. Amount is auto-filled — no manual entry needed.",
      "Diamonds are credited to your account within minutes. You'll receive a WhatsApp confirmation.",
    ],
    safety: [
      "We never ask for your Moonton account password, email OTP, or 2FA code.",
      "All payments are processed through Razorpay with 3D Secure and bank-grade encryption.",
      "Every order has a unique FM-XXXXXX tracking code — trackable anytime on our order page.",
      "If a top-up cannot be delivered we issue a full refund automatically.",
    ],
    faqs: [
      { q: "How long does an MLBB top-up take?", a: "Most Mobile Legends diamond orders on Fatui Market are delivered within 1–5 minutes after successful payment. Larger packs and passes are processed with the same priority." },
      { q: "Where do I find my MLBB User ID and Zone ID?", a: "In Mobile Legends, tap your profile avatar in the top-left. Your User ID appears first, followed by the Zone ID inside brackets — e.g. 123456789 (1234). Enter both when placing an order." },
      { q: "Is buying MLBB diamonds from Fatui Market safe?", a: "Yes. We use your User ID only — never your password. Diamonds are credited through legitimate top-up channels and every order is protected by our refund policy." },
      { q: "Can I pay in INR with UPI?", a: "Yes. Indian customers can pay in INR using GPay, PhonePe, Paytm, BHIM or any UPI app, along with cards, netbanking and wallet balance." },
      { q: "What's the cheapest MLBB pack you sell?", a: "The 3 Diamond pack at ₹6 is our smallest option. For real value under ₹150 look at the 86 Diamond pack or the Weekly Diamond Pass." },
    ],
    related: [
      { label: "Mobile Legends Top-Up", to: "/products/mobile-legends" },
      { label: "Honor of Kings Tokens", to: "/buy/honor-of-kings-tokens" },
      { label: "Free Fire Diamonds", to: "/buy/free-fire-diamonds" },
    ],
  },

  {
    slug: "genshin-impact-crystals",
    title: "Genshin Impact Top Up India — Genesis Crystals & Welkin",
    description:
      "Cheapest Genshin Impact top-up in India. Buy Genesis Crystals and Blessing of the Welkin Moon with UPI. Instant delivery, all servers supported.",
    h1: "Genshin Impact Genesis Crystals & Welkin Moon — India Top-Up",
    intro:
      "Top up Genshin Impact Genesis Crystals and Blessing of the Welkin Moon directly to your HoYoverse UID. Fatui Market supports all four Genshin servers — Asia, America, Europe and TW/HK/MO — with instant delivery, INR pricing and 24/7 support.",
    productSlug: "genshin-impact",
    breadcrumb: "Genshin Impact Top-Up",
    keywords: [
      "Cheapest Genshin Top Up India",
      "Genshin Impact Genesis Crystals India",
      "Welkin Moon India",
      "Genshin UID top up",
    ],
    sections: [
      {
        h2: "How Genshin Impact top-up works on Fatui Market",
        body: [
          "Genshin Impact runs on a Primogem economy. Genesis Crystals are the paid currency you convert into Primogems at a 1:1 ratio, which you then use for character and weapon wishes on limited banners. Fatui Market lets you buy Genesis Crystals in INR through UPI, cards or wallet balance — with no need to share your HoYoverse password.",
          "We simply need your 9-digit UID and server region. Once your payment is confirmed, Genesis Crystals are added to your account and are ready to use for wishes, Battle Pass or the Welkin Moon.",
        ],
      },
      {
        h2: "Genesis Crystal packs and Welkin Moon pricing",
        body: [
          "The Blessing of the Welkin Moon is the single best-value purchase in Genshin Impact — 300 Genesis Crystals up front plus 90 Primogems daily for 30 days, totalling 3,000 Primogems for around ₹389. For pull-heavy patches, higher denominations (1090, 2240, 3880, 8080) reduce the effective per-Primogem cost.",
        ],
      },
      {
        h2: "Servers we support",
        body: [
          "We ship Genesis Crystals to every Genshin server. Please select the correct region — Asia, America, Europe, or TW/HK/MO — when placing your order. Your UID's first digit reveals your server (6 = America, 7 = Europe, 8/9 = Asia, 18/19 = TW/HK/MO) but the in-game display is always the source of truth.",
        ],
      },
    ],
    table: {
      caption: "Genshin Impact pack cheat sheet",
      rows: [
        { pack: "60 Genesis Crystals", price: "₹75", note: "Starter pack" },
        { pack: "Welkin Moon (30 days)", price: "₹389", note: "Best value" },
        { pack: "330 Genesis Crystals", price: "₹357" },
        { pack: "1090 Genesis Crystals", price: "₹1,126" },
        { pack: "2240 Genesis Crystals", price: "₹2,445" },
        { pack: "3880 Genesis Crystals", price: "₹3,730" },
        { pack: "8080 Genesis Crystals", price: "₹7,640" },
      ],
    },
    buyingGuide: [
      "Launch Genshin Impact → open the Paimon menu → note your UID (bottom-right) and server region.",
      "Pick a Genesis Crystals pack or Welkin Moon on our Genshin product page.",
      "Enter your UID, choose your server, and continue to checkout.",
      "Pay in INR via UPI, card, netbanking, or wallet balance.",
      "Crystals are credited to your account, typically within minutes.",
    ],
    safety: [
      "Zero password sharing — your HoYoverse account stays fully under your control.",
      "Payments processed through Razorpay with 3D-Secure enforced.",
      "Automatic refund if a top-up cannot be completed.",
      "24/7 WhatsApp support for order tracking and edge cases.",
    ],
    faqs: [
      { q: "How long does Genshin Impact top-up take?", a: "Most Genesis Crystal and Welkin Moon orders are credited within a few minutes of successful payment." },
      { q: "Do I need to share my HoYoverse password?", a: "No. We only need your UID and server — never your password, email OTP or 2FA code." },
      { q: "Which server is cheapest?", a: "Fatui Market's INR pricing is the same across all servers. Choose whichever server your account uses." },
      { q: "Can I buy Welkin Moon monthly?", a: "Yes. You can renew the Welkin Moon as often as you like — the daily Primogem cycle resumes each time." },
      { q: "Is this cheaper than the in-game shop?", a: "For Indian players, converting USD in-game shop pricing to INR is usually more expensive than our UPI packs, especially at higher denominations." },
    ],
    related: [
      { label: "Genshin Impact Top-Up", to: "/products/genshin-impact" },
      { label: "Genshin Top-Up Guide", to: "/guides/genshin-impact-top-up" },
      { label: "Wuthering Waves Lunites", to: "/buy/wuthering-waves-lunites" },
    ],
  },

  {
    slug: "wuthering-waves-lunites",
    title: "Wuthering Waves Lunites India — Cheap Top-Up",
    description:
      "Buy Wuthering Waves Lunites and Lunite Subscription in India. Instant delivery to your Kuro Games UID. UPI, card, wallet — all servers.",
    h1: "Wuthering Waves Lunites — Top-Up for Every Server",
    intro:
      "Fatui Market makes Wuthering Waves top-up simple. Choose a Lunite pack or the Lunite Subscription, enter your UID and server, pay in INR and start pulling. We support SEA, Asia, America, Europe and HMT.",
    productSlug: "wuthering-waves",
    breadcrumb: "Wuthering Waves Lunites",
    keywords: [
      "Wuthering Waves Lunites India",
      "WuWa top up India",
      "Lunite Subscription India",
    ],
    sections: [
      {
        h2: "Lunites, Astrite and pulls — how it all fits",
        body: [
          "In Wuthering Waves, Lunites are the paid currency that converts into Astrite, which is what you spend on Convene (banner) pulls. Bigger Lunite packs come with bonus Lunites, giving a lower effective cost per pull. The Lunite Subscription mirrors Genshin's Welkin Moon — a small up-front amount plus daily Astrite for 30 days.",
        ],
      },
      {
        h2: "Which Lunite pack should I buy?",
        body: [
          "For light players, the Lunite Subscription is unbeatable value. For rate-up chasers who want to guarantee a 5★ resonator, stacking 1980+260 or 3280+600 packs is the fastest way to hit the pity ceiling. New accounts should grab the 60 and 300+30 packs first — they carry first-time double bonuses in-game.",
        ],
      },
      {
        h2: "Fast delivery to any Wuthering Waves server",
        body: [
          "We ship to SEA, Asia, America, Europe and HMT. Your UID and server must match — please double-check the server dropdown before payment. Wrong server means a delivery delay while we contact you.",
        ],
      },
    ],
    table: {
      caption: "Wuthering Waves Lunites pricing",
      rows: [
        { pack: "60 Lunites", price: "₹85" },
        { pack: "Lunite Subscription", price: "₹423", note: "Best value" },
        { pack: "300 + 30 Lunites", price: "₹420" },
        { pack: "980 + 110 Lunites", price: "₹1,260" },
        { pack: "1980 + 260 Lunites", price: "₹2,516" },
        { pack: "3280 + 600 Lunites", price: "₹4,160" },
        { pack: "6480 + 1600 Lunites", price: "₹8,167" },
      ],
    },
    buyingGuide: [
      "In Wuthering Waves, tap your profile icon to see your UID.",
      "Check the server pill in the top-left of the login screen (SEA, Asia, etc.).",
      "Choose a Lunite pack on our Wuthering Waves page.",
      "Enter UID, select the correct server, and pay in INR.",
      "Lunites are added to your account, usually within minutes.",
    ],
    safety: [
      "We never request Kuro Games account credentials.",
      "3D-Secure payment gateway (Razorpay) — no card data is stored on our servers.",
      "Refund guarantee if delivery is not possible.",
      "WhatsApp support 24/7 for stuck orders.",
    ],
    faqs: [
      { q: "Which is the best Lunite pack for pity?", a: "The 3280 + 600 pack is the sweet spot — enough Astrite for close to a soft-pity guarantee on a 5★ resonator without over-buying." },
      { q: "Can I buy the Lunite Subscription every month?", a: "Yes. The subscription resets every 30 days and you can renew as often as you want to keep the daily Astrite flowing." },
      { q: "What if I select the wrong server?", a: "Contact us on WhatsApp with your order code. We can usually correct the server before the top-up is dispatched." },
    ],
    related: [
      { label: "Wuthering Waves Top-Up", to: "/products/wuthering-waves" },
      { label: "Genshin Genesis Crystals", to: "/buy/genshin-impact-crystals" },
      { label: "Love and Deepspace Crystals", to: "/buy/love-and-deepspace-crystals" },
    ],
  },

  {
    slug: "pubg-mobile-uc",
    title: "PUBG Mobile UC India — Instant Top-Up | Fatui Market",
    description:
      "Buy PUBG Mobile UC in India at competitive prices. Royale Pass, crates, skins. UPI, card, wallet. Fast delivery to your Character ID.",
    h1: "PUBG Mobile UC — Instant Top-Up in India",
    intro:
      "Fatui Market delivers Unknown Cash (UC) to your PUBG Mobile account fast. Pick your UC pack, drop in your Character ID, pay in INR and jump back into Erangel with UC ready for the Royale Pass, crates and skins.",
    productSlug: "pubg-mobile",
    breadcrumb: "PUBG Mobile UC",
    keywords: [
      "PUBG Mobile UC India",
      "Cheapest PUBG UC India",
      "PUBG top up",
    ],
    sections: [
      {
        h2: "How PUBG Mobile UC works",
        body: [
          "UC is PUBG Mobile's premium currency. You use it to buy the Royale Pass, spin crates for weapon skins, unlock outfits, and grab limited-time bundles. Bigger UC packs carry bonus UC — the effective rate improves as the pack size goes up.",
        ],
      },
      {
        h2: "Which UC pack is best?",
        body: [
          "60 UC is enough for daily deals. 325 UC covers a Royale Pass. 660 UC gives you enough for a Pass plus a few crate spins. 1800 UC and above are the go-to picks for skin hunters and premium crate events.",
        ],
      },
    ],
    table: {
      caption: "PUBG Mobile UC packs",
      rows: [
        { pack: "60 UC", price: "$1" },
        { pack: "325 UC", price: "$5" },
        { pack: "660 UC", price: "$10" },
        { pack: "1800 UC", price: "$25" },
        { pack: "3850 UC", price: "$50", note: "+5% bonus" },
        { pack: "8100 UC", price: "$100", note: "+10% bonus" },
      ],
    },
    buyingGuide: [
      "Open PUBG Mobile → tap your avatar → note your Character ID.",
      "Choose a UC pack on our PUBG Mobile page.",
      "Enter your Character ID exactly as shown.",
      "Complete payment — UPI, card, wallet, netbanking.",
      "UC is credited to your account within minutes.",
    ],
    safety: [
      "Password-free — we only need your Character ID.",
      "Secure Razorpay checkout with 3D-Secure.",
      "Automatic refunds when a top-up cannot be delivered.",
      "24/7 support on WhatsApp.",
    ],
    faqs: [
      { q: "How quickly is UC delivered?", a: "PUBG Mobile UC is typically credited within a few minutes of successful payment." },
      { q: "Is this the official UC?", a: "Yes. UC is credited through legitimate top-up rails and shows up in your regular PUBG Mobile inventory." },
      { q: "Can I gift UC to another player?", a: "You can top up any Character ID — including a friend's. Just make sure the ID and server region are correct." },
    ],
    related: [
      { label: "PUBG Mobile Top-Up", to: "/products/pubg-mobile" },
      { label: "Free Fire Diamonds", to: "/buy/free-fire-diamonds" },
      { label: "Mobile Legends Diamonds", to: "/buy/mobile-legends-diamonds" },
    ],
  },

  {
    slug: "free-fire-diamonds",
    title: "Free Fire Diamonds India — Instant Top-Up | Fatui Market",
    description:
      "Cheapest Free Fire diamond top-up in India. Weekly & Monthly Membership, 100–5600 diamond packs. UPI, card, wallet. Instant delivery.",
    h1: "Free Fire Diamonds — Instant Top-Up in India",
    intro:
      "Booyah faster with Fatui Market. Buy Free Fire diamonds and memberships in INR, straight to your Player ID. We stock every popular pack from 100 diamonds up to 5,600 diamonds, plus Weekly and Monthly Memberships.",
    productSlug: "free-fire",
    breadcrumb: "Free Fire Diamonds",
    keywords: [
      "Free Fire Diamonds India",
      "Free Fire top up cheap",
      "Weekly Membership Free Fire",
    ],
    sections: [
      {
        h2: "Diamonds, Memberships and Elite Pass",
        body: [
          "In Free Fire, diamonds are the currency for the Elite Pass, characters, pets, gun skins and Luck Royale spins. The Weekly Membership grants a large diamond payout up front plus daily diamonds for 7 days, and the Monthly Membership does the same on a bigger scale.",
        ],
      },
      {
        h2: "Best Free Fire packs for Indian players",
        body: [
          "For casual players the 100 Diamond pack (₹80) covers gun crate spins. Serious Elite Pass grinders should grab the Weekly Membership. For skin collectors, the 1060 or 2180 packs deliver enough diamonds for Luck Royale streaks.",
        ],
      },
    ],
    table: {
      caption: "Free Fire pack cheat sheet",
      rows: [
        { pack: "100 Diamonds", price: "₹80" },
        { pack: "Weekly Membership", price: "₹158" },
        { pack: "310 Diamonds", price: "₹237" },
        { pack: "520 Diamonds", price: "₹395" },
        { pack: "Monthly Membership", price: "₹786" },
        { pack: "1060 Diamonds", price: "₹789" },
        { pack: "2180 Diamonds", price: "₹1,570" },
        { pack: "5600 Diamonds", price: "₹3,927" },
      ],
    },
    buyingGuide: [
      "Open Free Fire → tap your avatar → your Player ID is on your profile card.",
      "Choose a diamond pack or membership on our Free Fire page.",
      "Enter your Player ID and confirm.",
      "Pay in INR with UPI, card, netbanking or wallet balance.",
      "Diamonds or membership are credited within minutes.",
    ],
    safety: [
      "Only your Player ID is required — never your password.",
      "Razorpay checkout with bank-grade security.",
      "Refund policy backed by every order.",
      "24/7 chat support via WhatsApp.",
    ],
    faqs: [
      { q: "Are these diamonds official?", a: "Yes. Diamonds are credited to your Garena Free Fire account and can be spent on the Elite Pass, Luck Royale and store items normally." },
      { q: "What's the best pack for Elite Pass?", a: "The Weekly Membership plus 310 Diamonds combo comfortably unlocks the Elite Pass and leaves diamonds spare for spins." },
      { q: "Do memberships stack?", a: "Yes. Purchasing another Weekly or Monthly Membership before the current one ends extends the duration." },
    ],
    related: [
      { label: "Free Fire Top-Up", to: "/products/free-fire" },
      { label: "PUBG Mobile UC", to: "/buy/pubg-mobile-uc" },
      { label: "Mobile Legends Diamonds", to: "/buy/mobile-legends-diamonds" },
    ],
  },

  {
    slug: "honor-of-kings-tokens",
    title: "Honor of Kings Tokens India — Instant Top-Up",
    description:
      "Buy Honor of Kings Tokens & Weekly Card in India. From 16 Tokens to 8000+. UPI, card, wallet. Instant delivery to your HoK Player ID.",
    h1: "Honor of Kings Tokens — India Top-Up",
    intro:
      "Fatui Market is one of the fastest ways for Indian players to top up Honor of Kings Tokens. We stock every denomination from 16 Tokens up to 8000+ Tokens, plus the Weekly Card and Weekly Card Plus.",
    productSlug: "honor-of-kings",
    breadcrumb: "Honor of Kings Tokens",
    keywords: ["Honor of Kings India", "HoK Tokens India", "HoK top up"],
    sections: [
      {
        h2: "What Tokens unlock in Honor of Kings",
        body: [
          "Tokens are HoK's premium currency, used to buy heroes, skins, event passes and cosmetic bundles. The Weekly Card and Weekly Card Plus add daily Token drops for 7 days and are the highest ROI purchases in the game.",
        ],
      },
      {
        h2: "Which HoK pack is best?",
        body: [
          "New players should start with 80 or 240 Tokens plus the Weekly Card. Skin collectors move up to the 800+30 and 1200+45 packs. Whales and content creators buy 4000+180 and 8000+360 packs where the bonus Tokens push the effective rate to its lowest.",
        ],
      },
    ],
    table: {
      caption: "Honor of Kings pack cheat sheet",
      rows: [
        { pack: "80 Tokens", price: "₹94" },
        { pack: "Weekly Card", price: "₹122", note: "Best value" },
        { pack: "240 Tokens", price: "₹284" },
        { pack: "Weekly Card Plus", price: "₹347" },
        { pack: "800 + 30 Tokens", price: "₹923" },
        { pack: "4000 + 180 Tokens", price: "₹4,547" },
        { pack: "8000 + 360 Tokens", price: "₹9,094" },
      ],
    },
    buyingGuide: [
      "In Honor of Kings, tap your profile to see your Player ID.",
      "Pick a Token pack on our Honor of Kings page.",
      "Enter your Player ID and continue.",
      "Pay in INR — UPI, card, wallet or netbanking.",
      "Tokens are added to your account within minutes.",
    ],
    safety: [
      "Password-free top-ups — we only ask for your Player ID.",
      "Secure Razorpay payments with 3D-Secure.",
      "Full refunds if delivery fails.",
      "WhatsApp support around the clock.",
    ],
    faqs: [
      { q: "Is Honor of Kings available in India?", a: "Yes, and we support Indian players with INR pricing and UPI checkout." },
      { q: "Does the Weekly Card stack?", a: "Yes — buying another Weekly Card extends the daily Token drop period." },
      { q: "How fast is delivery?", a: "Most HoK Token orders are delivered within a few minutes of successful payment." },
    ],
    related: [
      { label: "Honor of Kings Top-Up", to: "/products/honor-of-kings" },
      { label: "Mobile Legends Diamonds", to: "/buy/mobile-legends-diamonds" },
      { label: "PUBG Mobile UC", to: "/buy/pubg-mobile-uc" },
    ],
  },

  {
    slug: "love-and-deepspace-crystals",
    title: "Love and Deepspace Crystals & Aurum Pass India",
    description:
      "Cheapest Love and Deepspace top-up in India. Buy Crystals, Aurum Pass under ₹300 & Companionship Pack. UPI, card, wallet. Instant.",
    h1: "Love and Deepspace Crystals, Aurum Pass & Bundles",
    intro:
      "Fatui Market keeps Love and Deepspace players stocked with Crystals, the Aurum Pass, and the Companionship Pack. Pay in INR through UPI or card, ship to Asia, America or Europe servers, and enjoy fast delivery on every order.",
    productSlug: "love-and-deepspace",
    breadcrumb: "Love and Deepspace",
    keywords: [
      "Love and Deepspace Aurum Pass under ₹300",
      "Cheapest Love and Deepspace Top Up India",
      "L&DS Crystals India",
    ],
    sections: [
      {
        h2: "Crystals, Aurum Pass and the Companionship Pack",
        body: [
          "Crystals are Love and Deepspace's paid currency, used for wishes on limited character banners, outfits and myth-lens memories. The Aurum Pass adds daily Crystal drops for 30 days and unlocks an exclusive outfit — it's the strongest value pickup in the game at under ₹300. The Companionship Pack bundles Crystals with premium extras for players deep in the meta.",
        ],
      },
      {
        h2: "Aurum Pass under ₹300 — why it's the best pick",
        body: [
          "For most players the Aurum Pass returns more value than any raw Crystal pack. At around ₹340 (or under ₹300 in regional promotions) it delivers a stream of Crystals across a month, making it the ideal 'always-on' pickup between banners.",
        ],
      },
    ],
    table: {
      caption: "Love and Deepspace packs",
      rows: [
        { pack: "60 Crystals", price: "₹99" },
        { pack: "Aurum Pass", price: "₹340", note: "Best value" },
        { pack: "300 + 30 Crystals", price: "₹429" },
        { pack: "450 + 90 Crystals", price: "₹599" },
        { pack: "980 + 150 Crystals", price: "₹1,249" },
        { pack: "1980 + 360 Crystals", price: "₹2,449" },
        { pack: "Companionship Pack", price: "₹1,499" },
      ],
    },
    buyingGuide: [
      "Open Love and Deepspace → tap your profile to find your UID.",
      "Confirm your server: Asia, America or Europe.",
      "Pick a Crystal pack, the Aurum Pass or the Companionship Pack.",
      "Enter UID and server, then pay in INR.",
      "Crystals or pass rewards are credited within minutes.",
    ],
    safety: [
      "We never ask for account passwords or verification codes.",
      "Payments via Razorpay with 3D-Secure enforced.",
      "Auto-refund on any failed delivery.",
      "WhatsApp support 24/7.",
    ],
    faqs: [
      { q: "Is the Aurum Pass really under ₹300?", a: "The base Aurum Pass sits close to ₹300 depending on live conversion rates and regional promotions. It's consistently our best-value Love and Deepspace product." },
      { q: "How is this cheaper than the in-app purchase?", a: "Google Play and App Store take a large regional cut. Direct top-up via Fatui Market skips those fees, so INR pricing works out lower for Indian players." },
      { q: "Can I stack Aurum Passes?", a: "Yes. Buying a second Aurum Pass before the current one expires simply extends the duration." },
    ],
    related: [
      { label: "Love and Deepspace Top-Up", to: "/products/love-and-deepspace" },
      { label: "Genshin Genesis Crystals", to: "/buy/genshin-impact-crystals" },
      { label: "Wuthering Waves Lunites", to: "/buy/wuthering-waves-lunites" },
    ],
  },

  {
    slug: "steam-wallet-codes",
    title: "Steam Wallet India — Buy Steam Codes Instantly",
    description:
      "Buy Steam Wallet codes in India — $5, $10, $20, $50, $100. Delivered instantly to your email. UPI, card, wallet accepted.",
    h1: "Steam Wallet Codes — India Delivery",
    intro:
      "Fatui Market sells digital Steam Wallet codes delivered straight to your email. Choose $5, $10, $20, $50 or $100 codes, redeem them on Steam, and load up your library with games, DLC or in-game currency.",
    productSlug: "steam-wallet",
    breadcrumb: "Steam Wallet",
    keywords: ["Steam Wallet India", "Buy Steam code India", "Steam gift card India"],
    sections: [
      {
        h2: "Why Steam Wallet codes?",
        body: [
          "Steam Wallet is Valve's built-in balance system on Steam. Once redeemed, your wallet balance can pay for any game, DLC, in-game item or subscription across the entire Steam catalog. Codes make it easy to gift games or avoid using a card on every purchase.",
        ],
      },
      {
        h2: "How to redeem a Steam Wallet code",
        body: [
          "Open Steam, click your account name in the top-right, choose 'Account details', then 'Add funds to your Steam Wallet' and 'Redeem a Steam Wallet code'. Paste the code we email you and hit Continue — your balance updates instantly.",
        ],
      },
    ],
    table: {
      caption: "Steam Wallet codes we stock",
      rows: [
        { pack: "$5 Steam Code", price: "$5.50" },
        { pack: "$10 Steam Code", price: "$10.80" },
        { pack: "$20 Steam Code", price: "$21.50" },
        { pack: "$50 Steam Code", price: "$52.00" },
        { pack: "$100 Steam Code", price: "$103.00" },
      ],
    },
    buyingGuide: [
      "Choose your Steam Wallet denomination.",
      "Enter your email — the code is delivered here.",
      "Complete payment in INR through Razorpay.",
      "Check your inbox — the code arrives within minutes.",
      "Redeem on Steam and start shopping.",
    ],
    safety: [
      "Codes are unused and delivered directly to you.",
      "Encrypted checkout via Razorpay.",
      "Instant refund if a code fails to redeem.",
      "Support available 24/7 via WhatsApp.",
    ],
    faqs: [
      { q: "Do Steam Wallet codes work in India?", a: "Yes, USD-denomination Steam codes work on Indian Steam accounts and top up your wallet in USD equivalent." },
      { q: "How long before I receive my code?", a: "Codes are dispatched to your email within minutes of successful payment." },
      { q: "What if the code doesn't redeem?", a: "Contact us with your order code (FM-XXXXXX) and we'll either replace the code or issue a refund." },
    ],
    related: [
      { label: "Steam Wallet Product", to: "/products/steam-wallet" },
      { label: "Google Play Gift Cards", to: "/buy/google-play-gift-cards" },
      { label: "Razer Gold Cards", to: "/buy/razer-gold-india" },
    ],
  },

  {
    slug: "google-play-gift-cards",
    title: "Google Play Gift Card India — Instant Codes",
    description:
      "Buy Google Play Gift Cards in India from ₹30 to ₹5000. Instant email delivery. UPI, card, wallet. Redeem for apps, games, subscriptions.",
    h1: "Google Play Gift Cards — Instant Delivery in India",
    intro:
      "Fatui Market delivers Google Play Gift Card codes to your email in minutes. Redeem them on Google Play for apps, games, in-app purchases, Google One, YouTube Premium and more.",
    productSlug: "google-play",
    breadcrumb: "Google Play Gift Cards",
    keywords: [
      "Google Play Gift Card India",
      "Google Play code India instant",
      "Play Store recharge India",
    ],
    sections: [
      {
        h2: "What can I buy with a Google Play code?",
        body: [
          "Once redeemed on your Google account, Play credit spends on paid apps, in-app purchases (MLBB diamonds, Free Fire diamonds, Genesis Crystals via the Play flow), YouTube Premium, Google One storage, movie rentals and more. Codes never expire, so you can save them for future purchases.",
        ],
      },
      {
        h2: "How to redeem",
        body: [
          "Open the Play Store → tap your profile → Payments & subscriptions → Redeem gift code. Paste the code we email you and confirm — the balance sits in your Play account until you spend it.",
        ],
      },
    ],
    table: {
      caption: "Google Play denominations",
      rows: [
        { pack: "₹30 Google Play", price: "₹35" },
        { pack: "₹50 Google Play", price: "₹58" },
        { pack: "₹100 Google Play", price: "₹112" },
        { pack: "₹200 Google Play", price: "₹220" },
        { pack: "₹500 Google Play", price: "₹535" },
        { pack: "₹1000 Google Play", price: "₹1,055" },
        { pack: "₹5000 Google Play", price: "₹5,180" },
      ],
    },
    buyingGuide: [
      "Pick your Google Play code denomination.",
      "Enter the email where you want the code sent.",
      "Pay in INR via Razorpay.",
      "The code lands in your inbox within minutes.",
      "Redeem it on the Play Store.",
    ],
    safety: [
      "Codes are freshly generated and unused.",
      "Payments protected with 3D-Secure.",
      "Refund guarantee on redemption failures.",
      "WhatsApp support available anytime.",
    ],
    faqs: [
      { q: "Can I use a ₹30 Play code for in-app purchases?", a: "Yes. Once redeemed to your Play balance, it can pay for any in-app purchase up to the balance amount." },
      { q: "Do Play codes expire?", a: "No. Google Play gift card codes do not expire once issued." },
      { q: "Which region works?", a: "We deliver INR-denomination codes for Indian Google accounts." },
    ],
    related: [
      { label: "Google Play Product", to: "/products/google-play" },
      { label: "Steam Wallet Codes", to: "/buy/steam-wallet-codes" },
      { label: "Razer Gold", to: "/buy/razer-gold-india" },
    ],
  },

  {
    slug: "razer-gold-india",
    title: "Razer Gold India — Buy Razer Gold Codes Instantly",
    description:
      "Buy Razer Gold codes in India from $1 to $300. Instant email delivery. Use on 2500+ games. UPI, card, wallet accepted.",
    h1: "Razer Gold Cards — Global Game Credit for India",
    intro:
      "Razer Gold is one of the most flexible game currencies on the planet — accepted across 2,500+ games and platforms. Fatui Market delivers Razer Gold codes to Indian players in minutes, in denominations from $1 up to $300.",
    productSlug: "razer-gold",
    breadcrumb: "Razer Gold Cards",
    keywords: ["Razer Gold India", "Buy Razer Gold code", "Razer Gold PIN India"],
    sections: [
      {
        h2: "What can I spend Razer Gold on?",
        body: [
          "Razer Gold funds top-ups across Mobile Legends, Free Fire, PUBG Mobile, Valorant, Genshin, League of Legends, MU Origin and thousands more titles. It's the closest thing to a universal gaming wallet, especially if you play multiple games across regions.",
        ],
      },
      {
        h2: "Which denomination should I pick?",
        body: [
          "$1–$5 codes are convenient for smaller battle passes and one-off bundles. $10–$50 codes are the sweet spot for regular top-ups. $100+ codes work well for whales and content creators who consolidate spending across games.",
        ],
      },
    ],
    table: {
      caption: "Razer Gold codes cheat sheet",
      rows: [
        { pack: "$1 Razer Gold", price: "₹88" },
        { pack: "$5 Razer Gold", price: "₹469" },
        { pack: "$10 Razer Gold", price: "₹927" },
        { pack: "$25 Razer Gold", price: "₹2,282" },
        { pack: "$50 Razer Gold", price: "₹4,560" },
        { pack: "$100 Razer Gold", price: "₹8,676" },
        { pack: "$300 Razer Gold", price: "₹27,320" },
      ],
    },
    buyingGuide: [
      "Choose your Razer Gold denomination.",
      "Enter the email where you'd like the code delivered.",
      "Pay securely in INR through Razorpay.",
      "Receive your PIN in your inbox within minutes.",
      "Redeem at razer.com/gold or in-app on supported games.",
    ],
    safety: [
      "Codes are original, unused and delivered to you only.",
      "Razorpay 3D-Secure payments.",
      "Refund if redemption fails.",
      "24/7 WhatsApp support.",
    ],
    faqs: [
      { q: "Can I use Razer Gold for Mobile Legends?", a: "Yes. Razer Gold is a supported top-up method for MLBB, Free Fire, PUBG Mobile and many other titles." },
      { q: "Does Razer Gold expire?", a: "Unredeemed Razer Gold PINs remain valid for a long period, but we recommend redeeming as soon as you receive them." },
      { q: "Is this a regional code?", a: "USD-denominated Razer Gold works globally, including on Indian Razer Gold accounts." },
    ],
    related: [
      { label: "Razer Gold Product", to: "/products/razer-gold" },
      { label: "Steam Wallet Codes", to: "/buy/steam-wallet-codes" },
      { label: "Google Play Codes", to: "/buy/google-play-gift-cards" },
    ],
  },

  {
    slug: "roblox-robux-india",
    title: "Roblox Robux India — Instant Top-Up | Fatui Market",
    description:
      "Buy Roblox Robux in India — 80, 400, 800, 1700, 4500, 10000 Robux. Direct top-up to your Roblox username. UPI, card, wallet.",
    h1: "Roblox Robux — Direct Top-Up in India",
    intro:
      "Fatui Market makes buying Robux for Indian players simple. Enter your Roblox username, pick a pack, pay in INR and we credit Robux directly to your account — no gift-card faff, no exchange headaches.",
    productSlug: "roblox",
    breadcrumb: "Roblox Robux",
    keywords: ["Roblox Robux India", "Buy Robux cheap", "Roblox top up India"],
    sections: [
      {
        h2: "How Robux works",
        body: [
          "Robux is the universal Roblox currency. Kids and creators spend it on avatar items, game passes, private servers and premium features across the entire Roblox platform. Larger Robux packs give a better per-Robux rate.",
        ],
      },
      {
        h2: "Which Robux pack should I buy?",
        body: [
          "80 Robux is great for a small avatar item. 400 or 800 Robux comfortably cover a game pass. 4500 and 10000 Robux packs are the picks for regular players and content creators.",
        ],
      },
    ],
    table: {
      caption: "Roblox Robux packs",
      rows: [
        { pack: "80 Robux", price: "₹99" },
        { pack: "400 Robux", price: "₹499" },
        { pack: "800 Robux", price: "₹999" },
        { pack: "1700 Robux", price: "₹1,999" },
        { pack: "4500 Robux", price: "₹4,999" },
        { pack: "10000 Robux", price: "₹10,999" },
      ],
    },
    buyingGuide: [
      "Choose a Robux pack on our Roblox page.",
      "Enter your Roblox username exactly as it appears in-game.",
      "Pay in INR via UPI, card, wallet or netbanking.",
      "Robux are credited to your Roblox account within minutes.",
      "You'll receive a WhatsApp confirmation once delivered.",
    ],
    safety: [
      "We never ask for your Roblox password.",
      "Razorpay-secured payments with 3D-Secure.",
      "Refund if delivery is not possible.",
      "WhatsApp support 24/7.",
    ],
    faqs: [
      { q: "Do I need Roblox Premium?", a: "No. Robux delivered by Fatui Market show up in your regular Roblox wallet and can be spent anywhere on the platform." },
      { q: "How is this cheaper than the app store?", a: "App store cuts and regional currency conversion inflate in-app prices. Direct top-up avoids that markup." },
      { q: "How long does delivery take?", a: "Most Robux orders are delivered within a few minutes of successful payment." },
    ],
    related: [
      { label: "Roblox Product", to: "/products/roblox" },
      { label: "Google Play Gift Cards", to: "/buy/google-play-gift-cards" },
      { label: "Razer Gold", to: "/buy/razer-gold-india" },
    ],
  },

  // ============================================================
  // KEYWORD-TARGETED LANDING PAGES
  // ============================================================
  {
    slug: "cheapest-mlbb-diamonds-under-150",
    title: "Cheapest MLBB Diamonds Under ₹150 — Fatui Market",
    description:
      "Every Mobile Legends diamond pack under ₹150 on Fatui Market. Weekly Pass, 86 diamonds and small stacks. Instant UPI top-up.",
    h1: "Cheapest MLBB Diamonds Under ₹150",
    intro:
      "If your budget is tight but you still want to grab a Weekly Pass or clear a small event, these are the Mobile Legends packs on Fatui Market that fit inside ₹150.",
    productSlug: "mobile-legends",
    breadcrumb: "MLBB Diamonds Under ₹150",
    keywords: ["Cheapest MLBB Diamonds under ₹150", "MLBB cheap diamonds"],
    sections: [
      {
        h2: "Best small packs under ₹150",
        body: [
          "Small diamond packs are perfect for daily objectives, magic wheel spins and the Weekly Diamond Pass. Below ₹150 you can pick up the Weekly Pass itself (₹148), the 86 Diamond pack (₹124) or stack smaller packs for exactly the amount you need.",
          "Buying a Weekly Pass rather than a raw diamond pack is almost always a better deal for casual players — you get ~200 diamonds of value across 7 days of daily rewards.",
        ],
      },
      {
        h2: "How to make ₹150 stretch further",
        body: [
          "Combine the Weekly Diamond Pass with a small 5–22 diamond pack to cover a specific magic wheel spin. Watch for in-game 'first-time' double diamond bonuses, which double the diamonds on your very first purchase in each pack size.",
        ],
      },
    ],
    table: {
      caption: "MLBB packs under ₹150",
      rows: [
        { pack: "3 Diamonds", price: "₹6" },
        { pack: "5 Diamonds", price: "₹9" },
        { pack: "11 Diamonds", price: "₹17" },
        { pack: "22 Diamonds", price: "₹34" },
        { pack: "55 Diamonds", price: "₹85" },
        { pack: "Weekly Elite", price: "₹78" },
        { pack: "86 Diamonds", price: "₹124", note: "Best value" },
        { pack: "Weekly Diamond Pass", price: "₹148", note: "Best value" },
      ],
    },
    buyingGuide: [
      "Open Mobile Legends → tap your avatar to find your User ID + Zone ID.",
      "Pick a pack under ₹150 from the list above.",
      "Enter both IDs when placing the order.",
      "Pay via UPI in INR — no card required.",
      "Diamonds or pass rewards arrive within minutes.",
    ],
    safety: [
      "Password-free top-ups; only your User ID and Zone ID are needed.",
      "Razorpay checkout with 3D-Secure.",
      "Auto-refund on delivery failure.",
      "WhatsApp support 24/7.",
    ],
    faqs: [
      { q: "Which is cheaper — 86 diamonds or Weekly Pass?", a: "The Weekly Pass at ₹148 delivers more total value than an 86-diamond pack, though the raw diamond cost per rupee looks similar. If you play daily, always pick the Pass." },
      { q: "Can I buy multiple small packs?", a: "Yes. You can stack multiple orders of the same pack size. Each order is credited independently." },
      { q: "Are these prices the cheapest?", a: "These are Fatui Market's UPI-first INR prices. We regularly benchmark against other Indian sellers to stay competitive." },
    ],
    related: [
      { label: "Mobile Legends Landing", to: "/buy/mobile-legends-diamonds" },
      { label: "MLBB Weekly Pass India", to: "/buy/mlbb-weekly-pass-india" },
      { label: "MLBB Product Page", to: "/products/mobile-legends" },
    ],
  },

  {
    slug: "mlbb-weekly-pass-india",
    title: "MLBB Weekly Pass India — Instant Top-Up",
    description:
      "Buy the Mobile Legends Weekly Diamond Pass in India for ₹148. 7 days of daily diamond rewards. Instant delivery to your User ID.",
    h1: "MLBB Weekly Pass — Instant Top-Up in India",
    intro:
      "The Weekly Diamond Pass is Mobile Legends' best long-term value pickup. For ₹148 on Fatui Market you unlock 7 days of daily diamond drops — often netting more diamonds than a raw pack at the same price.",
    productSlug: "mobile-legends",
    breadcrumb: "MLBB Weekly Pass",
    keywords: ["MLBB Weekly Pass India", "Mobile Legends Weekly Pass", "MLBB Weekly Diamond Pass"],
    sections: [
      {
        h2: "What the Weekly Pass includes",
        body: [
          "The Weekly Diamond Pass grants a bulk diamond payout up front plus daily diamond drops for the next 7 days. Total value is comfortably over 200 diamonds worth of currency — well above what a same-priced raw pack would deliver.",
        ],
      },
      {
        h2: "Stacking passes",
        body: [
          "You can buy 2× or 3× Weekly Passes to extend the daily reward window. Combining a Weekly Pass with 172 diamonds is a popular option for players clearing skin drops.",
        ],
      },
    ],
    table: {
      caption: "Weekly Pass and combos",
      rows: [
        { pack: "Weekly Pass", price: "₹148" },
        { pack: "Weekly Pass + 172 Diamonds", price: "₹391" },
        { pack: "2× Weekly Pass", price: "₹296" },
        { pack: "3× Weekly Pass", price: "₹444" },
        { pack: "2× WP + 172 Diamonds", price: "₹539" },
        { pack: "3× WP + 172 Diamonds", price: "₹687" },
      ],
    },
    buyingGuide: [
      "Get your MLBB User ID + Zone ID from your in-game profile.",
      "Select Weekly Pass on our Mobile Legends page (or a combo).",
      "Enter your IDs correctly.",
      "Pay in INR through UPI, card or wallet.",
      "The pass activates on your account within minutes.",
    ],
    safety: [
      "Password-free — we only ask for your MLBB IDs.",
      "Razorpay checkout, 3D-Secure enforced.",
      "Refunds on failed deliveries.",
      "WhatsApp support 24/7.",
    ],
    faqs: [
      { q: "Do daily diamond drops carry over if I miss a day?", a: "You must log in daily to collect the reward. Missed days are not compensated, but the pass itself keeps ticking down." },
      { q: "Can I stack 2 or 3 passes together?", a: "Yes. Stacked passes extend the daily reward window, so 3× Weekly Pass lasts 3 weeks." },
      { q: "How fast is delivery?", a: "Most Weekly Pass orders activate within a few minutes of successful payment." },
    ],
    related: [
      { label: "Cheapest MLBB Under ₹150", to: "/buy/cheapest-mlbb-diamonds-under-150" },
      { label: "MLBB Landing", to: "/buy/mobile-legends-diamonds" },
      { label: "MLBB Product Page", to: "/products/mobile-legends" },
    ],
  },
];

export const getSeoLanding = (slug: string) =>
  SEO_LANDINGS.find((p) => p.slug === slug);
