import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { NotificationCenter } from "@/components/admin/notification-center";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Fatui Market Admin" },
      {
        name: "description",
        content: "Live operational alerts for Fatui Market: supplier health, pricing changes, orders and wallet warnings.",
      },
      { property: "og:title", content: "Notifications — Fatui Market Admin" },
      { property: "og:description", content: "Live operational alerts for Fatui Market admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
  errorComponent: NotificationsError,
  notFoundComponent: () => (
    <div className="surface-card p-8 text-center text-sm text-muted-foreground">No notifications found.</div>
  ),
});

function NotificationsPage() {
  return <NotificationCenter />;
}

function NotificationsError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error("[/admin/notifications] render error:", error);
  return (
    <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
      <Bell className="h-8 w-8 text-muted-foreground" />
      <div className="text-sm font-semibold">Notifications couldn't load</div>
      <p className="max-w-md text-xs text-muted-foreground">{error.message}</p>
      <button
        onClick={() => {
          void router.invalidate();
          reset();
        }}
        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
      >
        Try again
      </button>
    </div>
  );
}
