import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Admin gate used by the /admin layout.
 *
 * Verifies the session, opportunistically claims the admin role for the
 * configured admin email, then confirms the role server-side via the
 * `user_roles` table (never from client storage).
 */
export function useAdminGuard() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/auth", search: { redirect: "/admin" } });
        return;
      }
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session?.access_token) {
          await fetch("/api/public/claim-admin", {
            method: "POST",
            headers: { authorization: `Bearer ${sess.session.access_token}` },
          });
        }
      } catch {
        /* non-fatal */
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      if (!role) {
        toast.error("Admin access required");
        navigate({ to: "/" });
        return;
      }
      setUserId(u.user.id);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return { ready, userId };
}
