import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage, safeUUID } from "@/lib/safe-browser";

const KEY = "fatui_visitor_session";

let memoSessionId = "";

/** Stable anonymous session id — survives refreshes, unique per browser/device. */
export function getVisitorSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = safeLocalStorage.getItem(KEY) || memoSessionId;
  if (!id) {
    id = safeUUID();
    memoSessionId = id;
    safeLocalStorage.setItem(KEY, id);
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

/** Coarse browser family — used only for aggregate analytics. */
export function getBrowser(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Other";
}

/** Records/refreshes the anonymous visitor session. No IPs or personal data. */
export async function sendVisitorHeartbeat() {
  const sessionId = getVisitorSessionId();
  if (!sessionId) return;
  let referrer: string | undefined;
  try {
    if (document.referrer && !document.referrer.includes(location.host)) {
      referrer = new URL(document.referrer).hostname;
    }
  } catch { /* ignore */ }

  try {
    await supabase.rpc("visitor_heartbeat", {
      _session_id: sessionId,
      _device_type: getDeviceType(),
      _referrer: referrer,
      _browser: getBrowser(),
    });
  } catch {
    /* offline or blocked network — analytics must never break the page */
  }
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
  let row: Record<string, number> | null = null;
  try {
    const { data } = await supabase.rpc("get_visitor_stats", { _tz_offset_minutes: offset });
    row = Array.isArray(data) ? data[0] : null;
  } catch {
    return null; // network failure — keep the last known numbers on screen
  }
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
