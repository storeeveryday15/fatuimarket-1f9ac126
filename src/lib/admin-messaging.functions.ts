import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Target = { user_id: string; email?: string | null };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Sends an admin message to one or more customers: an in-app notification row
 * and (optionally) an email through Resend. Admin-only.
 */
export const sendCustomerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    targets: Target[];
    title: string;
    body: string;
    link?: string | null;
    image_url?: string | null;
    game_slug?: string | null;
    category?: string;
    email: boolean;
    announcement_id?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const title = data.title.slice(0, 160).trim();
    const body = data.body.slice(0, 2000).trim();
    if (!title || !body) throw new Error("Title and message are required");

    const targets = data.targets.filter((t) => !!t.user_id).slice(0, 5000);
    if (targets.length === 0) return { inApp: 0, emails: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Respect per-customer notification preferences.
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("user_id,email_enabled,announcements_enabled")
      .in("user_id", targets.map((t) => t.user_id));
    const prefMap = new Map((prefs ?? []).map((p) => [p.user_id, p]));

    const rows = targets
      .filter((t) => prefMap.get(t.user_id)?.announcements_enabled !== false)
      .map((t) => ({
        user_id: t.user_id,
        category: data.category ?? "announcements",
        title,
        body,
        link: data.link ?? null,
        image_url: data.image_url ?? null,
        game_slug: data.game_slug ?? null,
        announcement_id: data.announcement_id ?? null,
      }));

    if (rows.length) {
      const { error } = await supabaseAdmin.from("notifications").insert(rows);
      if (error) throw new Error(error.message);
    }

    let emails = 0;
    const resendKey = process.env['RESEND_API_KEY'];
    if (data.email && resendKey) {
      const recipients = targets
        .filter((t) => !!t.email && prefMap.get(t.user_id)?.email_enabled !== false)
        .map((t) => t.email as string);
      for (const to of recipients.slice(0, 200)) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: "Fatui Market <onboarding@resend.dev>",
              to,
              subject: title,
              html: `<div style="font-family:system-ui,sans-serif"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p></div>`,
            }),
          });
          if (res.ok) emails += 1;
        } catch {
          /* best effort */
        }
      }
    }

    return { inApp: rows.length, emails };
  });
