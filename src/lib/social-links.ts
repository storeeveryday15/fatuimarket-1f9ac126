/**
 * Official Fatui Market links.
 *
 * Rows live in `public.social_links` (admin-editable, publicly readable).
 * The fallback list keeps the UI working before the first fetch resolves or
 * if the network call fails.
 */

import { supabase } from "@/integrations/supabase/client";

export type SocialLink = {
  key: string;
  label: string;
  url: string;
  emoji: string;
  description: string;
};

export const FALLBACK_SOCIAL_LINKS: SocialLink[] = [
  { key: "website", label: "Visit Website", url: "https://fatuimarket.shop", emoji: "🌐", description: "Official Fatui Market store" },
  { key: "youtube", label: "Watch on YouTube", url: "https://youtube.com/@fatuimarket?si=z4P9xR9qAxaWLcMj", emoji: "▶️", description: "Videos, guides and giveaways" },
  { key: "instagram", label: "Follow on Instagram", url: "https://www.instagram.com/fatuimarket?igsh=bDhvNW44dGUwYXRo", emoji: "📸", description: "Daily posts and stories" },
  { key: "facebook", label: "Follow on Facebook", url: "https://www.facebook.com/share/199YZVigUE/", emoji: "📘", description: "Facebook page" },
  { key: "telegram", label: "Join Telegram", url: "https://t.me/fatuimarket", emoji: "✈️", description: "Announcements and community" },
  { key: "whatsapp_channel", label: "Join WhatsApp Channel", url: "https://whatsapp.com/channel/0029VbD2uz34Y9ljxvkbLS3A", emoji: "📢", description: "Offers and announcements" },
  { key: "whatsapp", label: "Chat on WhatsApp", url: "https://wa.me/917679393645", emoji: "💬", description: "Direct customer support" },
  { key: "email", label: "Email Support", url: "mailto:fatuimarket@gmail.com", emoji: "📧", description: "Support inbox" },
];

let cache: SocialLink[] | null = null;
let inflight: Promise<SocialLink[]> | null = null;

/** Active official links, newest admin values first, cached per page load. */
export async function loadSocialLinks(): Promise<SocialLink[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("social_links")
        .select("key,label,url,emoji,description")
        .eq("active", true)
        .order("sort_order");
      if (error || !data?.length) return FALLBACK_SOCIAL_LINKS;
      cache = data as SocialLink[];
      return cache;
    } catch {
      return FALLBACK_SOCIAL_LINKS;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Brand accent classes per known link key (design tokens / brand hues only). */
export const SOCIAL_STYLES: Record<string, string> = {
  website: "border-[var(--neon)]/40 bg-[var(--neon)]/10 text-[var(--neon)] hover:bg-[var(--neon)]/20",
  youtube: "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20",
  instagram: "border-pink-500/40 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-400/10 text-pink-400 hover:from-purple-500/20 hover:via-pink-500/20 hover:to-orange-400/20",
  facebook: "border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
  telegram: "border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20",
  whatsapp_channel: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
  whatsapp: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
  email: "border-border bg-secondary/40 text-foreground hover:bg-secondary",
};

export function socialStyle(key: string) {
  return SOCIAL_STYLES[key] ?? "border-border bg-secondary/40 text-foreground hover:bg-secondary";
}
