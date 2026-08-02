import { createFileRoute } from "@tanstack/react-router";

// Grants the 'admin' role to the currently signed-in user IF their email
// matches the ADMIN_EMAIL secret. Also syncs the app_config.admin_email row
// so the auth trigger keeps working for future signups.
// Safe to call on every login.

export const Route = createFileRoute("/api/public/claim-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
        if (!adminEmail) {
          return Response.json({ ok: false, error: "ADMIN_EMAIL not set" }, { status: 400 });
        }

        const auth = request.headers.get("authorization") || "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
        if (!token) return Response.json({ ok: false, error: "no token" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Keep app_config in sync
        await supabaseAdmin.from("app_config").upsert(
          { key: "admin_email", value: adminEmail },
          { onConflict: "key" },
        );

        const { data: userRes, error: uErr } = await supabaseAdmin.auth.getUser(token);
        if (uErr || !userRes.user) {
          return Response.json({ ok: false, error: "invalid token" }, { status: 401 });
        }
        const user = userRes.user;
        const email = (user.email || "").toLowerCase();
        // Only a verified mailbox may claim the admin role — an unconfirmed
        // signup must never be able to grab privileges.
        const emailVerified = !!user.email_confirmed_at || !!user.confirmed_at;

        let isAdmin = false;
        if (email === adminEmail && emailVerified) {
          await supabaseAdmin.from("user_roles").upsert(
            { user_id: user.id, role: "admin" },
            { onConflict: "user_id,role", ignoreDuplicates: true },
          );
          isAdmin = true;
        }

        return Response.json({ ok: true, isAdmin });
      },
    },
  },
});
