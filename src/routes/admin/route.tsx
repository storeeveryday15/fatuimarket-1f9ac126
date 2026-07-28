import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAdminGuard } from "@/lib/admin/use-admin-guard";
import { AdminNav } from "@/components/admin/admin-nav";
import { NotificationBell, NotificationCenter } from "@/components/admin/notification-center";

/**
 * Admin layout: authenticates + authorises once, then renders the shared
 * navigation, notification centre and the active admin page.
 */
export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { ready } = useAdminGuard();
  const [panelOpen, setPanelOpen] = useState(false);

  if (!ready) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-16 text-center text-sm text-muted-foreground">
        Verifying admin access…
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-[var(--neon)]" />
          <h1 className="text-2xl font-bold sm:text-3xl">Fatui Control Centre</h1>
        </div>
        <NotificationBell onClick={() => setPanelOpen(true)} />
      </div>

      <AdminNav />
      <Outlet />

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setPanelOpen(false)}>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" />
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-bold">Notifications</div>
              <button onClick={() => setPanelOpen(false)} className="rounded-md border border-border px-2 py-1 text-xs">
                Close
              </button>
            </div>
            <NotificationCenter variant="popover" />
          </div>
        </div>
      )}
    </div>
  );
}
