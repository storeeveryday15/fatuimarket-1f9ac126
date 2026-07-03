import { supabase } from "@/integrations/supabase/client";

type Event = "created" | "screenshot_uploaded" | "processing" | "completed" | "rejected";

export async function notifyOrder(order_code: string, event: Event) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return; // require sign-in; skip silently otherwise
    await fetch("/api/public/notify-order", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order_code, event }),
    });
  } catch {
    /* best-effort */
  }
}
