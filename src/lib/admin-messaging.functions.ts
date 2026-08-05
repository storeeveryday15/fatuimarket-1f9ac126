import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { personalize } from "@/lib/email/personalize";
import { openPixelUrl, trackedLink } from "@/lib/email/tracking";

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
 * Admin-only. Copy is personalized per recipient, every email gets a tracking
 * token, and failures are reported back.
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

    const rawTitle = data.title.slice(0, 160).trim();
    const rawBody = data.body.slice(0, 4000).trim();
    if (!rawTitle || !rawBody) throw new Error("Title and message are required");

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

    const ids = targets.map((t) => t.user_id);

    // Respect per-customer notification preferences.
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("user_id,email_enabled,announcements_enabled")
      .in("user_id", ids);
    const prefMap = new Map((prefs ?? []).map((p) => [p.user_id, p]));

    // Personalization inputs: profile fields + most-ordered game per customer.
    const { data: profileRows } = await supabaseAdmin
      .from("profiles")
      .select("id,display_name,username,email,wallet_balance")
      .in("id", ids);
    const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));

    const { data: orderRows } = await supabaseAdmin
      .from("orders")
      .select("user_id,product_name")
      .in("user_id", ids)
      .limit(20000);
    const gameCounts = new Map<string, Map<string, number>>();
    for (const o of orderRows ?? []) {
      if (!o.user_id || !o.product_name) continue;
      const inner = gameCounts.get(o.user_id) ?? new Map<string, number>();
      inner.set(o.product_name, (inner.get(o.product_name) ?? 0) + 1);
      gameCounts.set(o.user_id, inner);
    }
    const favoriteGame = (userId: string) => {
      const inner = gameCounts.get(userId);
      if (!inner) return null;
      return [...inner.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };

    const ctxFor = (userId: string, email?: string | null) => {
      const p = profileMap.get(userId);
      return {
        display_name: p?.display_name ?? null,
        username: p?.username ?? null,
        email: p?.email ?? email ?? null,
        favorite_game: favoriteGame(userId),
        wallet_balance: p?.wallet_balance ?? 0,
      };
    };

    const rows = targets
      .filter((t) => prefMap.get(t.user_id)?.announcements_enabled !== false)
      .map((t) => {
        const ctx = ctxFor(t.user_id, t.email);
        return {
          user_id: t.user_id,
          category: data.category ?? "announcements",
          title: personalize(rawTitle, ctx),
          body: personalize(rawBody, ctx),
          link: data.link ?? null,
          image_url: data.image_url ?? null,
          game_slug: data.game_slug ?? null,
          announcement_id: data.announcement_id ?? null,
        };
      });

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

    // Official links for the permanent branded footer.
    const { data: socials } = await supabaseAdmin
      .from("social_links")
      .select("key,label,url,emoji")
      .eq("active", true)
      .order("sort_order");
    const footerLinks = (socials ?? [])
      .filter((s) => !s.url.startsWith("mailto:") && s.key !== "website")
      .map((s) => ({ key: s.key, label: s.label.replace(/^(Follow on|Join|Chat on|Watch on)\s+/i, ""), url: s.url, emoji: s.emoji }));

    const recipients = targets.filter(
      (t) => !!t.email && prefMap.get(t.user_id)?.email_enabled !== false,
    );
    result.skipped = targets.length - recipients.length;

    for (const t of recipients.slice(0, 1000)) {
      const ctx = ctxFor(t.user_id, t.email);
      const title = personalize(rawTitle, ctx);
      const body = personalize(rawBody, ctx);
      const token = crypto.randomUUID().replace(/-/g, "");

      await supabaseAdmin.from("email_recipients").insert({
        token,
        announcement_id: data.announcement_id ?? null,
        user_id: t.user_id,
        email: t.email!,
        template_name: "announcement",
        status: "sent",
      });

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
              buttonLink: data.link ? trackedLink(token, data.link) : null,
              footerLinks: footerLinks.map((l) => ({ ...l, url: trackedLink(token, l.url) })),
              preferencesUrl: trackedLink(token, "https://fatuimarket.shop/dashboard"),
              trackingPixelUrl: openPixelUrl(token),
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
          await supabaseAdmin
            .from("email_recipients")
            .update({ status: "suppressed" })
            .eq("token", token);
        } else {
          result.failed += 1;
          const msg = payload.error ?? payload.reason ?? `HTTP ${res.status}`;
          await supabaseAdmin
            .from("email_recipients")
            .update({ status: "failed", error_message: msg })
            .eq("token", token);
          if (!result.errors.includes(msg)) result.errors.push(msg);
        }
      } catch (err) {
        result.failed += 1;
        const msg = err instanceof Error ? err.message : "Network error";
        await supabaseAdmin
          .from("email_recipients")
          .update({ status: "failed", error_message: msg })
          .eq("token", token);
        if (!result.errors.includes(msg)) result.errors.push(msg);
      }
    }

    return result;
  });
