import logo from "@/assets/fatui-logo.asset.json";
import ff from "@/assets/game-ff.jpg";
import pubg from "@/assets/game-pubg.jpg";
import valorant from "@/assets/game-valorant.jpg";
import steam from "@/assets/game-steam.jpg";
import gplay from "@/assets/game-gplay.jpg";

export const LOGO_URL = logo.url;

export type Denomination = {
  id: string;
  label: string;
  price: number; // USD
  priceINR?: number; // explicit INR; otherwise computed
  bonus?: string;
};

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
  denominations: Denomination[];
};

// MLBB image: use the logo as the product cover so site visually matches the brand
export const PRODUCTS: Product[] = [
  {
    slug: "mobile-legends",
    name: "Mobile Legends",
    publisher: "Moonton",
    currency: "Diamonds",
    tagline: "Top up MLBB diamonds instantly to your account.",
    image: logo.url,
    accent: "from-fuchsia-500 to-violet-600",
    needsPlayerId: true,
    idLabel: "User ID (Zone ID)",
    idPlaceholder: "123456789 (1234)",
    denominations: [
      // Diamonds
      { id: "m-d5",    label: "💎 5 Diamonds",        price: 0.14, priceINR: 12 },
      { id: "m-d11",   label: "💎 10 + 1 Diamonds",   price: 0.24, priceINR: 20 },
      { id: "m-d22",   label: "💎 20 + 2 Diamonds",   price: 0.45, priceINR: 37 },
      { id: "m-d56",   label: "💎 51 + 5 Diamonds",   price: 1.15, priceINR: 94.99 },
      { id: "m-d112",  label: "💎 102 + 10 Diamonds", price: 2.13, priceINR: 176.97 },
      { id: "m-d223",  label: "💎 203 + 20 Diamonds", price: 4.42, priceINR: 366.89 },
      { id: "m-d336",  label: "💎 303 + 33 Diamonds", price: 6.69, priceINR: 554.96 },
      { id: "m-d570",  label: "💎 504 + 66 Diamonds", price: 11.08, priceINR: 919.77 },
      { id: "m-d1163", label: "💎 1007 + 156 Diamonds", price: 22.05, priceINR: 1830 },
      { id: "m-d2398", label: "💎 2015 + 383 Diamonds", price: 44.07, priceINR: 3658 },
      { id: "m-d6042", label: "💎 5035 + 1007 Diamonds", price: 109.58, priceINR: 9095 },
      // First Top-Up
      { id: "m-ft55",  label: "🎁 First Top-Up 50 + 5",   price: 1.11, priceINR: 92.33,  bonus: "First TU" },
      { id: "m-ft165", label: "🎁 First Top-Up 150 + 15", price: 3.22, priceINR: 267.40, bonus: "First TU" },
      { id: "m-ft275", label: "🎁 First Top-Up 250 + 25", price: 5.12, priceINR: 424.96, bonus: "First TU" },
      { id: "m-ft565", label: "🎁 First Top-Up 500 + 65", price: 10.42, priceINR: 864.97, bonus: "First TU" },
      // Weekly
      { id: "m-wp",    label: "🎫 Weekly Diamond Pass",   price: 1.82, priceINR: 150.55, bonus: "Weekly" },
    ],
  },
  {
    slug: "free-fire",
    name: "Free Fire",
    publisher: "Garena",
    currency: "Diamonds",
    tagline: "Power up your loadout with Free Fire diamonds.",
    image: ff,
    accent: "from-orange-500 to-rose-600",
    needsPlayerId: true,
    idLabel: "Player ID",
    idPlaceholder: "Enter your Free Fire ID",
    denominations: [
      { id: "f1", label: "100 Diamonds", price: 1 },
      { id: "f2", label: "310 Diamonds", price: 3 },
      { id: "f3", label: "520 Diamonds", price: 5 },
      { id: "f4", label: "1060 Diamonds", price: 10 },
      { id: "f5", label: "2180 Diamonds", price: 20, bonus: "+8%" },
      { id: "f6", label: "5600 Diamonds", price: 50, bonus: "+12%" },
      { id: "f7", label: "Weekly Membership", price: 2 },
      { id: "f8", label: "Monthly Membership", price: 8 },
    ],
  },
  {
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    publisher: "Tencent",
    currency: "UC",
    tagline: "Stock up on UC for skins, crates and the Royale Pass.",
    image: pubg,
    accent: "from-amber-500 to-orange-700",
    needsPlayerId: true,
    idLabel: "Character ID",
    idPlaceholder: "Enter your PUBG Mobile ID",
    denominations: [
      { id: "p1", label: "60 UC", price: 1 },
      { id: "p2", label: "325 UC", price: 5 },
      { id: "p3", label: "660 UC", price: 10 },
      { id: "p4", label: "1800 UC", price: 25 },
      { id: "p5", label: "3850 UC", price: 50, bonus: "+5%" },
      { id: "p6", label: "8100 UC", price: 100, bonus: "+10%" },
    ],
  },
  {
    slug: "valorant",
    name: "Valorant",
    publisher: "Riot Games",
    currency: "VP",
    tagline: "Unlock skins, agents and battle pass with Valorant Points.",
    image: valorant,
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
  {
    slug: "google-play",
    name: "Google Play",
    publisher: "Google",
    currency: "Gift Code",
    tagline: "Google Play gift codes for apps, games and subscriptions.",
    image: gplay,
    accent: "from-emerald-500 to-teal-600",
    needsPlayerId: false,
    denominations: [
      { id: "g1", label: "$10 Gift Code", price: 10.5 },
      { id: "g2", label: "$25 Gift Code", price: 25.8 },
      { id: "g3", label: "$50 Gift Code", price: 51 },
      { id: "g4", label: "$100 Gift Code", price: 101 },
    ],
  },
];

export const getProduct = (slug: string) =>
  PRODUCTS.find((p) => p.slug === slug);

export const WHATSAPP_NUMBER = "917679393645";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hi Fatui Market, I need help with my order."
)}`;
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
