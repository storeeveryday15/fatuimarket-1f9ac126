/**
 * First-party email tracking helpers.
 *
 * The sending provider only reports bounces, complaints and unsubscribes, so
 * opens and clicks are measured with a tracking pixel and a click redirector.
 */

export const TRACKING_ORIGIN = "https://fatuimarket.shop";

/** Hosts a tracked link is allowed to redirect to (prevents an open redirect). */
const ALLOWED_HOSTS = [
  "fatuimarket.shop",
  "www.fatuimarket.shop",
  "fatuimarket.lovable.app",
  "wa.me",
  "whatsapp.com",
  "www.whatsapp.com",
  "chat.whatsapp.com",
  "instagram.com",
  "www.instagram.com",
  "t.me",
  "telegram.me",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
];

export function isAllowedRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:" && u.protocol !== "mailto:") return false;
    if (u.protocol === "mailto:") return true;
    return ALLOWED_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function openPixelUrl(token: string) {
  return `${TRACKING_ORIGIN}/api/public/e/o?t=${encodeURIComponent(token)}`;
}

export function trackedLink(token: string, url: string) {
  if (!url || url.startsWith("mailto:")) return url;
  return `${TRACKING_ORIGIN}/api/public/e/c?t=${encodeURIComponent(token)}&u=${encodeURIComponent(url)}`;
}

/** Very small user-agent classifier — enough for device / client split. */
export function classifyUserAgent(ua: string | null | undefined) {
  const s = (ua ?? "").toLowerCase();
  const device =
    /iphone|android|mobile|ipod/.test(s) ? "mobile" : /ipad|tablet/.test(s) ? "tablet" : "desktop";
  let client = "Other";
  if (s.includes("googleimageproxy") || s.includes("gmail")) client = "Gmail";
  else if (s.includes("outlook") || s.includes("microsoft") || s.includes("msoffice")) client = "Outlook";
  else if (s.includes("applemail") || s.includes("apple-mail") || (s.includes("mac os x") && s.includes("safari"))) client = "Apple Mail";
  else if (s.includes("yahoo")) client = "Yahoo Mail";
  else if (s.includes("thunderbird")) client = "Thunderbird";
  else if (s.includes("chrome") || s.includes("firefox")) client = "Web browser";
  return { device, client };
}
