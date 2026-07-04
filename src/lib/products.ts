import logo from "@/assets/fatui-logo.asset.json";
import ff from "@/assets/game-ff.jpg.asset.json";
import pubg from "@/assets/game-pubg.jpg.asset.json";
import valorant from "@/assets/game-valorant.jpg.asset.json";
import steam from "@/assets/game-steam.jpg";
import gplay from "@/assets/game-gplay.jpg.asset.json";
import wuwa from "@/assets/game-wuwa.jpg.asset.json";
import genshin from "@/assets/game-genshin.jpg.asset.json";
import lads from "@/assets/game-lads.jpg.asset.json";
import hok from "@/assets/game-mlbb.jpg.asset.json";
import razer from "@/assets/game-razer.jpg.asset.json";
import mlbb from "@/assets/game-mlbb-new.jpg.asset.json";
import roblox from "@/assets/game-roblox.jpg.asset.json";

export const LOGO_URL = logo.url;

export type Denomination = {
  id: string;
  label: string;
  price: number; // USD
  priceINR?: number; // explicit INR; otherwise computed
  bonus?: string;
};

export type Server = { id: string; label: string };

export const USD_TO_INR = 83;
export const getINR = (d: Denomination) =>
  d.priceINR ?? Math.round(d.price * USD_TO_INR);

export type Product = {
  slug: string;
  name: string;
  publisher: string;
  currency: string;
  tagline: string;
  image: string;
  accent: string;
  needsPlayerId: boolean;
  idLabel?: string;
  idPlaceholder?: string;
  needsServer?: boolean;
  servers?: Server[];
  denominations: Denomination[];
};

const GENSHIN_SERVERS: Server[] = [
  { id: "asia", label: "Asia" },
  { id: "america", label: "America" },
  { id: "europe", label: "Europe" },
  { id: "tw-hk-mo", label: "TW / HK / MO" },
];

const WUWA_SERVERS: Server[] = [
  { id: "sea", label: "SEA" },
  { id: "asia", label: "Asia" },
  { id: "america", label: "America" },
  { id: "europe", label: "Europe" },
  { id: "hmt", label: "HMT" },
];

const LADS_SERVERS: Server[] = [
  { id: "asia", label: "Asia" },
  { id: "america", label: "America" },
  { id: "europe", label: "Europe" },
];

// Utility to compute USD from INR when only INR is provided
const inr = (rupees: number, usd?: number): { priceINR: number; price: number } => ({
  priceINR: rupees,
  price: usd ?? Math.round((rupees / USD_TO_INR) * 100) / 100,
});

export const PRODUCTS: Product[] = [
  // 1) Mobile Legends — full replacement per new list
  {
    slug: "mobile-legends",
    name: "Mobile Legends",
    publisher: "Moonton",
    currency: "Diamonds",
    tagline: "Instant MLBB diamond top-up to your account.",
    image: mlbb.url,
    accent: "from-fuchsia-500 to-violet-600",
    needsPlayerId: true,
    idLabel: "User ID (Zone ID)",
    idPlaceholder: "123456789 (1234)",
    denominations: [
      { id: "mlbb-d3",   label: "💎 3 Diamonds",   ...inr(6,   0.09) },
      { id: "mlbb-d5",   label: "💎 5 Diamonds",   ...inr(9,   0.14) },
      { id: "mlbb-d11",  label: "💎 11 Diamonds",  ...inr(17,  0.24) },
      { id: "mlbb-d22",  label: "💎 22 Diamonds",  ...inr(34,  0.49) },
      { id: "mlbb-d55",  label: "💎 55 Diamonds",  ...inr(85,  1.19) },
      { id: "mlbb-d86",  label: "💎 86 Diamonds",  ...inr(124, 1.79) },
      { id: "mlbb-d112", label: "💎 112 Diamonds", ...inr(165, 2.39) },
      { id: "mlbb-d172", label: "💎 172 Diamonds", ...inr(243, 3.49) },
      { id: "mlbb-d257", label: "💎 257 Diamonds", ...inr(349, 4.99) },
      { id: "mlbb-d706", label: "💎 706 Diamonds", ...inr(946, 12.49) },
      { id: "mlbb-wp",     label: "🎫 Weekly Pass",              ...inr(148, 1.99),  bonus: "Weekly" },
      { id: "mlbb-wp172",  label: "💎 Weekly Pass + 172 Diamonds", ...inr(391, 5.49),  bonus: "Combo" },
      { id: "mlbb-wp2",    label: "🎫 2× Weekly Pass",           ...inr(296, 3.99),  bonus: "Weekly" },
      { id: "mlbb-wp3",    label: "🎫 3× Weekly Pass",           ...inr(444, 5.99),  bonus: "Weekly" },
      { id: "mlbb-wp2-172",label: "💎 2× WP + 172 Diamonds",     ...inr(539, 7.49),  bonus: "Combo" },
      { id: "mlbb-wp3-172",label: "💎 3× WP + 172 Diamonds",     ...inr(687, 9.49),  bonus: "Combo" },
      { id: "mlbb-elite",  label: "⭐ Weekly Elite",             ...inr(78,  1.19),  bonus: "Elite" },
      { id: "mlbb-twi",    label: "🌙 Twilight Pass",            ...inr(779, 10.99), bonus: "Pass" },
      { id: "mlbb-star",   label: "✨ Starlight",                ...inr(467, 6.99),  bonus: "Monthly" },
      { id: "mlbb-star+",  label: "👑 Starlight Plus",           ...inr(1166, 16.99), bonus: "Monthly" },
    ],
  },

  // 2) Wuthering Waves
  {
    slug: "wuthering-waves",
    name: "Wuthering Waves",
    publisher: "Kuro Games",
    currency: "Lunites",
    tagline: "Top up Lunites to your Wuthering Waves UID instantly.",
    image: wuwa.url,
    accent: "from-indigo-500 to-blue-700",
    needsPlayerId: true,
    idLabel: "UID",
    idPlaceholder: "Enter your WuWa UID",
    needsServer: true,
    servers: WUWA_SERVERS,
    denominations: [
      { id: "wuwa-60",   label: "💠 60 Lunites",          ...inr(85,   1.09) },
      { id: "wuwa-330",  label: "💠 300 + 30 Lunites",    ...inr(420,  4.99) },
      { id: "wuwa-1090", label: "💠 980 + 110 Lunites",   ...inr(1260, 14.99) },
      { id: "wuwa-2240", label: "💠 1980 + 260 Lunites",  ...inr(2516, 29.99) },
      { id: "wuwa-3880", label: "💠 3280 + 600 Lunites",  ...inr(4160, 49.99) },
      { id: "wuwa-8080", label: "💠 6480 + 1600 Lunites", ...inr(8167, 96.99) },
      { id: "wuwa-sub",  label: "🌙 Lunite Subscription", ...inr(423,  5.29), bonus: "Monthly" },
    ],
  },

  // 3) Genshin Impact
  {
    slug: "genshin-impact",
    name: "Genshin Impact",
    publisher: "HoYoverse",
    currency: "Genesis Crystals",
    tagline: "Instant Genesis Crystals top-up for any Genshin region.",
    image: genshin.url,
    accent: "from-emerald-500 to-teal-700",
    needsPlayerId: true,
    idLabel: "UID",
    idPlaceholder: "Enter your Genshin UID",
    needsServer: true,
    servers: GENSHIN_SERVERS,
    denominations: [
      { id: "gi-60",   label: "💠 60 Genesis Crystals",   ...inr(75) },
      { id: "gi-330",  label: "💠 330 Genesis Crystals",  ...inr(357) },
      { id: "gi-1090", label: "💠 1090 Genesis Crystals", ...inr(1126) },
      { id: "gi-2240", label: "💠 2240 Genesis Crystals", ...inr(2445) },
      { id: "gi-3880", label: "💠 3880 Genesis Crystals", ...inr(3730) },
      { id: "gi-8080", label: "💠 8080 Genesis Crystals", ...inr(7640) },
      { id: "gi-welkin", label: "🌙 Blessing of the Welkin Moon", ...inr(389), bonus: "Monthly" },
    ],
  },

  // 4) Free Fire — updated pricing
  {
    slug: "free-fire",
    name: "Free Fire",
    publisher: "Garena",
    currency: "Diamonds",
    tagline: "Booyah faster with instant Free Fire diamond top-up.",
    image: ff.url,
    accent: "from-orange-500 to-rose-600",
    needsPlayerId: true,
    idLabel: "Player ID",
    idPlaceholder: "Enter your Free Fire ID",
    denominations: [
      { id: "ff-100",   label: "💎 100 Diamonds",     ...inr(80,   0.89) },
      { id: "ff-week",  label: "🎫 Weekly Membership", ...inr(158, 1.79), bonus: "Weekly" },
      { id: "ff-310",   label: "💎 310 Diamonds",     ...inr(237,  2.69) },
      { id: "ff-520",   label: "💎 520 Diamonds",     ...inr(395,  4.49) },
      { id: "ff-month", label: "🌙 Monthly Membership", ...inr(786, 8.99), bonus: "Monthly" },
      { id: "ff-1060",  label: "💎 1060 Diamonds",    ...inr(789,  8.99) },
      { id: "ff-2180",  label: "💎 2180 Diamonds",    ...inr(1570, 17.99) },
      { id: "ff-5600",  label: "💎 5600 Diamonds",    ...inr(3927, 44.99) },
    ],
  },

  // 5) Love and Deepspace
  {
    slug: "love-and-deepspace",
    name: "Love and Deepspace",
    publisher: "Papergames",
    currency: "Crystals",
    tagline: "Top up Crystals for your Love and Deepspace UID.",
    image: lads.url,
    accent: "from-pink-500 to-fuchsia-700",
    needsPlayerId: true,
    idLabel: "UID",
    idPlaceholder: "Enter your L&DS UID",
    needsServer: true,
    servers: LADS_SERVERS,
    denominations: [
      { id: "lads-60",   label: "💠 60 Crystals",         ...inr(99,   1.49) },
      { id: "lads-330",  label: "💠 300 + 30 Crystals",   ...inr(429,  5.99) },
      { id: "lads-540",  label: "💠 450 + 90 Crystals",   ...inr(599,  8.49) },
      { id: "lads-1130", label: "💠 980 + 150 Crystals",  ...inr(1249, 17.99) },
      { id: "lads-2340", label: "💠 1980 + 360 Crystals", ...inr(2449, 34.99) },
      { id: "lads-4000", label: "💠 3280 + 720 Crystals", ...inr(3999, 56.99) },
      { id: "lads-8080", label: "💠 6480 + 1600 Crystals", ...inr(7999, 112.99) },
      { id: "lads-aurum", label: "🎫 Aurum Pass",          ...inr(340,  3.59),  bonus: "Pass" },
      { id: "lads-comp",  label: "💕 Companionship Pack",  ...inr(1499, 21.99), bonus: "Pack" },
    ],
  },

  // 6) Honor of Kings
  {
    slug: "honor-of-kings",
    name: "Honor of Kings",
    publisher: "TiMi Studios",
    currency: "Tokens",
    tagline: "Instant Tokens top-up for Honor of Kings.",
    image: hok.url,
    accent: "from-red-500 to-amber-600",
    needsPlayerId: true,
    idLabel: "Player ID",
    idPlaceholder: "Enter your HoK ID",
    denominations: [
      { id: "hok-16",   label: "🪙 16 Tokens",           ...inr(22) },
      { id: "hok-80",   label: "🪙 80 Tokens",           ...inr(94) },
      { id: "hok-240",  label: "🪙 240 Tokens",          ...inr(284) },
      { id: "hok-400",  label: "🪙 400 Tokens",          ...inr(468) },
      { id: "hok-560",  label: "🪙 560 Tokens",          ...inr(655) },
      { id: "hok-830",  label: "🪙 800 + 30 Tokens",     ...inr(923) },
      { id: "hok-1245", label: "🪙 1200 + 45 Tokens",    ...inr(1384) },
      { id: "hok-2508", label: "🪙 2400 + 108 Tokens",   ...inr(2759) },
      { id: "hok-4180", label: "🪙 4000 + 180 Tokens",   ...inr(4547) },
      { id: "hok-8360", label: "🪙 8000 + 360 Tokens",   ...inr(9094) },
      { id: "hok-wc",   label: "🎫 Weekly Card",         ...inr(122), bonus: "Weekly" },
      { id: "hok-wcp",  label: "🎫 Weekly Card Plus",    ...inr(347), bonus: "Weekly" },
    ],
  },

  // 7) PUBG Mobile (kept)
  {
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    publisher: "Tencent",
    currency: "UC",
    tagline: "Stock up on UC for skins, crates and the Royale Pass.",
    image: pubg.url,
    accent: "from-amber-500 to-orange-700",
    needsPlayerId: true,
    idLabel: "Character ID",
    idPlaceholder: "Enter your PUBG Mobile ID",
    denominations: [
      { id: "p1", label: "60 UC",   price: 1 },
      { id: "p2", label: "325 UC",  price: 5 },
      { id: "p3", label: "660 UC",  price: 10 },
      { id: "p4", label: "1800 UC", price: 25 },
      { id: "p5", label: "3850 UC", price: 50, bonus: "+5%" },
      { id: "p6", label: "8100 UC", price: 100, bonus: "+10%" },
    ],
  },

  // 8) Valorant
  {
    slug: "valorant",
    name: "Valorant",
    publisher: "Riot Games",
    currency: "VP",
    tagline: "Unlock skins, agents and battle pass with Valorant Points.",
    image: valorant.url,
    accent: "from-rose-500 to-red-700",
    needsPlayerId: true,
    idLabel: "Riot ID #Tag",
    idPlaceholder: "Username#TAG",
    denominations: [
      { id: "v1", label: "475 VP", price: 5 },
      { id: "v2", label: "1000 VP", price: 10 },
      { id: "v3", label: "2050 VP", price: 20 },
      { id: "v4", label: "3650 VP", price: 35 },
      { id: "v5", label: "5350 VP", price: 50 },
      { id: "v6", label: "11000 VP", price: 100 },
    ],
  },

  // 9) Steam Wallet
  {
    slug: "steam-wallet",
    name: "Steam Wallet",
    publisher: "Valve",
    currency: "USD Code",
    tagline: "Digital Steam wallet codes delivered to your email.",
    image: steam,
    accent: "from-sky-500 to-indigo-700",
    needsPlayerId: false,
    denominations: [
      { id: "s1", label: "$5 Steam Code", price: 5.5 },
      { id: "s2", label: "$10 Steam Code", price: 10.8 },
      { id: "s3", label: "$20 Steam Code", price: 21.5 },
      { id: "s4", label: "$50 Steam Code", price: 52 },
      { id: "s5", label: "$100 Steam Code", price: 103 },
    ],
  },

  // 10) Google Play Gift Cards
  {
    slug: "google-play",
    name: "Google Play Gift Cards",
    publisher: "Google",
    currency: "Gift Code",
    tagline: "Google Play codes delivered instantly to your email.",
    image: gplay.url,
    accent: "from-emerald-500 to-teal-600",
    needsPlayerId: false,
    denominations: [
      { id: "gp-30",   label: "🎁 ₹30 Google Play",   ...inr(35) },
      { id: "gp-50",   label: "🎁 ₹50 Google Play",   ...inr(58) },
      { id: "gp-100",  label: "🎁 ₹100 Google Play",  ...inr(112) },
      { id: "gp-200",  label: "🎁 ₹200 Google Play",  ...inr(220) },
      { id: "gp-300",  label: "🎁 ₹300 Google Play",  ...inr(325) },
      { id: "gp-500",  label: "🎁 ₹500 Google Play",  ...inr(535) },
      { id: "gp-1000", label: "🎁 ₹1000 Google Play", ...inr(1055) },
      { id: "gp-2000", label: "🎁 ₹2000 Google Play", ...inr(2085) },
      { id: "gp-5000", label: "🎁 ₹5000 Google Play", ...inr(5180) },
    ],
  },

  // 11) Razer Gold Cards
  {
    slug: "razer-gold",
    name: "Razer Gold Cards",
    publisher: "Razer",
    currency: "Gold Code",
    tagline: "Razer Gold codes for games, skins and passes worldwide.",
    image: razer.url,
    accent: "from-green-500 to-emerald-700",
    needsPlayerId: false,
    denominations: [
      { id: "rz-1",   label: "🟢 1 USD Razer Gold",   ...inr(88,    1) },
      { id: "rz-2",   label: "🟢 2 USD Razer Gold",   ...inr(176,   2) },
      { id: "rz-4",   label: "🟢 4 USD Razer Gold",   ...inr(563,   4) },
      { id: "rz-5",   label: "🟢 5 USD Razer Gold",   ...inr(469,   5) },
      { id: "rz-10",  label: "🟢 10 USD Razer Gold",  ...inr(927,   10) },
      { id: "rz-15",  label: "🟢 15 USD Razer Gold",  ...inr(1420,  15) },
      { id: "rz-20",  label: "🟢 20 USD Razer Gold",  ...inr(1829,  20) },
      { id: "rz-25",  label: "🟢 25 USD Razer Gold",  ...inr(2282,  25) },
      { id: "rz-30",  label: "🟢 30 USD Razer Gold",  ...inr(2789,  30) },
      { id: "rz-35",  label: "🟢 35 USD Razer Gold",  ...inr(3278,  35) },
      { id: "rz-40",  label: "🟢 40 USD Razer Gold",  ...inr(3662,  40) },
      { id: "rz-50",  label: "🟢 50 USD Razer Gold",  ...inr(4560,  50) },
      { id: "rz-60",  label: "🟢 60 USD Razer Gold",  ...inr(5578,  60) },
      { id: "rz-70",  label: "🟢 70 USD Razer Gold",  ...inr(6569,  70) },
      { id: "rz-100", label: "🟢 100 USD Razer Gold", ...inr(8676,  100) },
      { id: "rz-150", label: "🟢 150 USD Razer Gold", ...inr(13959, 150) },
      { id: "rz-200", label: "🟢 200 USD Razer Gold", ...inr(18352, 200) },
      { id: "rz-300", label: "🟢 300 USD Razer Gold", ...inr(27320, 300) },
    ],
  },

  // 12) Roblox
  {
    slug: "roblox",
    name: "Roblox",
    publisher: "Roblox Corp",
    currency: "Robux",
    tagline: "Instant Robux top-up to your Roblox account.",
    image: roblox.url,
    accent: "from-red-500 to-rose-700",
    needsPlayerId: true,
    idLabel: "Roblox Username",
    idPlaceholder: "Enter your Roblox username",
    denominations: [
      { id: "rbx-80",    label: "🎮 80 Robux",    ...inr(99,   1.09) },
      { id: "rbx-400",   label: "🎮 400 Robux",   ...inr(499,  5.49) },
      { id: "rbx-800",   label: "🎮 800 Robux",   ...inr(999,  10.99) },
      { id: "rbx-1700",  label: "🎮 1700 Robux",  ...inr(1999, 21.99) },
      { id: "rbx-4500",  label: "🎮 4500 Robux",  ...inr(4999, 54.99) },
      { id: "rbx-10000", label: "🎮 10000 Robux", ...inr(10999, 109.99) },
    ],
  },
];

export const getProduct = (slug: string) =>
  PRODUCTS.find((p) => p.slug === slug);

export const WHATSAPP_NUMBER = "917679393645";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hi Fatui Market, I need help with my order."
)}`;
export const whatsappLinkFor = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
export const WHATSAPP_CHANNEL_LINK = "https://whatsapp.com/channel/0029VbD2uz34Y9ljxvkbLS3A";
export const CONTACT_PHONE = "+91 76793 93645";
export const CONTACT_EMAIL = "fatuimarket@gmail.com";
export const FACEBOOK_LINK = "https://www.facebook.com/share/192oekurGU/";
export const INSTAGRAM_LINK = "https://www.instagram.com/everyday_store_official?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==";
export const TELEGRAM_LINK = "https://t.me/fatuimarket";

// Coupon + cashback
export const WELCOME_COUPON = "WELCOME2FATUI";
export const WELCOME_DISCOUNT_INR = 5;
export function computeCashbackINR(amountInr: number): number {
  if (!amountInr || amountInr <= 0) return 0;
  if (amountInr >= 1000) return 30;
  if (amountInr >= 500) return 10;
  if (amountInr >= 60) return 5;
  return 2;
}

export const UPI_ID = "7679393645@kotakbank";
export const UPI_MERCHANT = "Lakpa Tamang";
export const buildUpiLink = (amountInr: number, note?: string) =>
  `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_MERCHANT)}&am=${amountInr}&cu=INR${note ? `&tn=${encodeURIComponent(note)}` : ""}`;

// Order code generator: FM-XXXXXX
export function generateOrderCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `FM-${s}`;
}
