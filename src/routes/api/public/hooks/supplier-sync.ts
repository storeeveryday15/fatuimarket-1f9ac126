import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled supplier catalog sync.
 *
 * Called by pg_cron with the project's publishable key in the `apikey` header.
 * Never returns supplier credentials or cost data.
 */
export const Route = createFileRoute("/api/public/hooks/supplier-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runCatalogSync } = await import("@/lib/flashtopup-catalog.server");
          const result = await runCatalogSync(supabaseAdmin);
          return Response.json({ success: true, ...result });
        } catch (err) {
          console.error("[flashtopup] scheduled sync failed", err instanceof Error ? err.message : err);
          // The last successful catalog keeps serving; the failure is logged for admins.
          return Response.json({ success: false, error: "Catalog sync failed" }, { status: 500 });
        }
      },
    },
  },
});
