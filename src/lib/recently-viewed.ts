import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceType, getVisitorSessionId } from "@/lib/visitor-session";
import { safeLocalStorage } from "@/lib/safe-browser";

export type ViewedItem = { slug: string; tier?: string; at: number };

const KEY = "fm_recently_viewed";
const MAX = 10;
const EVENT = "fm:recently-viewed";

export function readRecentlyViewed(): ViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = safeLocalStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is ViewedItem => !!v && typeof (v as ViewedItem).slug === "string")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function recordProductView(slug: string, tier?: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [{ slug, tier, at: Date.now() }, ...readRecentlyViewed().filter((v) => v.slug !== slug)].slice(0, MAX);
    safeLocalStorage.setItem(KEY, JSON.stringify(next));

    // Anonymous view analytics for the admin dashboard (no personal data).
    void supabase
      .rpc("record_product_view", {
        _product_slug: slug,
        _tier_label: tier ?? undefined,
        _session_id: getVisitorSessionId() || undefined,
        _device_type: getDeviceType(),
      })
      .then(undefined, () => undefined);

    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* viewing history is optional — never break the product page */
  }
}

/** Live list of the last 10 products the customer opened. */
export function useRecentlyViewed(): ViewedItem[] {
  const [items, setItems] = useState<ViewedItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(readRecentlyViewed());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return items;
}
