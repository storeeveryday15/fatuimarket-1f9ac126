import { createFileRoute } from "@tanstack/react-router";
import { classifyUserAgent } from "@/lib/email/tracking";

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

function pixelResponse() {
  return new Response(PIXEL, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate, private",
    },
  });
}

export const Route = createFileRoute("/api/public/e/o")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const token = new URL(request.url).searchParams.get("t");
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
                event: "open",
                user_agent: ua?.slice(0, 400) ?? null,
                device,
                client,
                country: request.headers.get("cf-ipcountry"),
              });
            }
          }
        } catch (err) {
          console.error("[email open tracking]", err);
        }
        return pixelResponse();
      },
    },
  },
});
