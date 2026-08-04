import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Target = { user_id: string; email?: string | null };

export type SendResult = {
  inApp: number;
  emails: number;
  failed: number;
  skipped: number;
  errors: string[];
};

/**
 * Sends an admin message to one or more customers: an in-app notification row
 * and (optionally) a branded email through the project's email infrastructure.
 * Admin-only. Every email attempt is logged and failures are reported back.
 */
export const sendCustomerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    targets?: Target[];
    title: string;
    body: string;
    link?: string | null;
    image_url?: string | null;
    game_slug?: string | null;
    category?: string;
    email: boolean;
    announcement_id?: string | null;
  }) => input)
  .handler(async ({ data, context }): Promise<SendResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const title = data.title.slice(0, 160).trim();
    const body = data.body.slice(0, 4000).trim();
    if (!title || !body) throw new Error("Title and message are required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve recipients server-side so nothing depends on what the browser sent.
    let targets: Target[] = (data.targets ?? []).filter((t) => !!t.user_id);
    if (targets.length === 0) {
      const { data: profiles, error } = await supabaseAdmin
        .from("profiles")
        .select("id,email")
        .limit(5000);
      if (error) throw new Error(error.message);
      targets = (profiles ?? []).map((p) => ({ user_id: p.id, email: p.email }));
    }
    targets = targets.slice(0, 5000);

    const result: SendResult = { inApp: 0, emails: 0, failed: 0, skipped: 0, errors: [] };
    if (targets.length === 0) return result;

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
      result.inApp = rows.length;
    }

    if (!data.email) return result;

    // Send through the project's email pipeline (queue + delivery logging).
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const origin = new URL(request.url).origin;
    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader) {
      result.errors.push("Missing authorization header for email send");
      return result;
    }

    const recipients = targets.filter(
      (t) => !!t.email && prefMap.get(t.user_id)?.email_enabled !== false,
    );
    result.skipped = targets.length - recipients.length;

    for (const t of recipients.slice(0, 1000)) {
      try {
        const res = await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: authHeader },
          body: JSON.stringify({
            templateName: "announcement",
            recipientEmail: t.email,
            idempotencyKey: `announcement-${data.announcement_id ?? title.slice(0, 32)}-${t.user_id}`,
            templateData: {
              title,
              body,
              imageUrl: data.image_url ?? null,
              buttonText: data.link ? "Open Fatui Market" : null,
              buttonLink: data.link ?? null,
            },
          }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          reason?: string;
          error?: string;
        };
        if (res.ok && payload.success) {
          result.emails += 1;
        } else if (res.ok && payload.reason === "email_suppressed") {
          result.skipped += 1;
        } else {
          result.failed += 1;
          const msg = payload.error ?? payload.reason ?? `HTTP ${res.status}`;
          if (!result.errors.includes(msg)) result.errors.push(msg);
        }
      } catch (err) {
        result.failed += 1;
        const msg = err instanceof Error ? err.message : "Network error";
        if (!result.errors.includes(msg)) result.errors.push(msg);
      }
    }

    return result;
  });
