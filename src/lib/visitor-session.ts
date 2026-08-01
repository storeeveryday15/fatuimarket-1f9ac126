import { supabase } from "@/integrations/supabase/client";

const KEY = "fatui_visitor_session";

/** Stable anonymous session id — survives refreshes, unique per browser/device. */
export function getVisitorSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    try {
      document.cookie = `${KEY}=${id};path=/;max-age=31536000;SameSite=Lax`;
    } catch { /* ignore */ }
  }
  return id;
}

export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  return "desktop";
}

/** Records/refreshes the anonymous visitor session. No IPs or personal data. */
export async function sendVisitorHeartbeat() {
  const sessionId = getVisitorSessionId();
  if (!sessionId) return;
  let referrer: string | null = null;
  try {
    if (document.referrer && !document.referrer.includes(location.host)) {
      referrer = new URL(document.referrer).hostname;
    }
  } catch { /* ignore */ }

  await supabase.rpc("visitor_heartbeat", {
    _session_id: sessionId,
    _device_type: getDeviceType(),
    _referrer: referrer,
  });
}

export type VisitorStats = {
  online: number;
  today: number;
  total: number;
  desktop: number;
  mobile: number;
  tablet: number;
};

export const EMPTY_VISITOR_STATS: VisitorStats = {
  online: 0, today: 0, total: 0, desktop: 0, mobile: 0, tablet: 0,
};

export async function fetchVisitorStats(): Promise<VisitorStats | null> {
  const offset = -new Date().getTimezoneOffset(); // minutes east of UTC
  const { data } = await supabase.rpc("get_visitor_stats", { _tz_offset_minutes: offset });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    online: row.online ?? 0,
    today: row.today ?? 0,
    total: row.total ?? 0,
    desktop: row.desktop ?? 0,
    mobile: row.mobile ?? 0,
    tablet: row.tablet ?? 0,
  };
}
