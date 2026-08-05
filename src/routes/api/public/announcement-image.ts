import { createFileRoute } from "@tanstack/react-router";

/**
 * Public read-only proxy for announcement banner images.
 *
 * The `announcements` storage bucket is private, but email clients must be
 * able to fetch the banner without a session, so this route streams the file
 * (server-side, service role) for the given object path only.
 */
export const Route = createFileRoute("/api/public/announcement-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("p") ?? "";
        if (!path || path.includes("..") || path.startsWith("/")) {
          return new Response("Not found", { status: 404 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage.from("announcements").download(path);
          if (error || !data) return new Response("Not found", { status: 404 });
          return new Response(await data.arrayBuffer(), {
            headers: {
              "content-type": data.type || "image/jpeg",
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        } catch (err) {
          console.error("[announcement-image]", err);
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
