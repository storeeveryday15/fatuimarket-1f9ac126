import { createFileRoute } from "@tanstack/react-router";
import { classifyUserAgent, isAllowedRedirect, TRACKING_ORIGIN } from "@/lib/email/tracking";

export const Route = createFileRoute("/api/public/e/c")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t");
        const target = url.searchParams.get("u") ?? "";
        const destination = isAllowedRedirect(target) ? target : TRACKING_ORIGIN;

        try {
          if (token) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: recipient } = await supabaseAdmin
              .from("email_recipients")
              .select("announcement_id,email")
              .eq("token", token)
              .maybeSingle();
            if (recipient) {
              const ua = request.headers.get("user-agent");
              const { device, client } = classifyUserAgent(ua);
              await supabaseAdmin.from("email_events").insert({
                recipient_token: token,
                announcement_id: recipient.announcement_id,
                email: recipient.email,
                event: "click",
                url: destination.slice(0, 500),
                user_agent: ua?.slice(0, 400) ?? null,
                device,
                client,
                country: request.headers.get("cf-ipcountry"),
              });
            }
          }
        } catch (err) {
          console.error("[email click tracking]", err);
        }

        return new Response(null, {
          status: 302,
          headers: { location: destination, "cache-control": "no-store" },
        });
      },
    },
  },
});
