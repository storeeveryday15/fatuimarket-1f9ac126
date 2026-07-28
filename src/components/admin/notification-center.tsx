import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { SEVERITY_META, type AdminNotification } from "@/lib/admin/types";
import { Bell, Check, Search } from "lucide-react";

/**
 * Notification centre.
 * Rendered both as a compact bell popover (admin layout header) and as a full
 * page at /admin/notifications via the `variant` prop.
 */
export function NotificationCenter({ variant = "page" }: { variant?: "page" | "popover" }) {
  const { rows, loading } = useRealtimeTable<AdminNotification>("admin_notifications", { limit: 200 });
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<string>("all");

  const items = useMemo(() => {
    const list = rows ?? [];
    return list.filter((n) => {
      if (severity !== "all" && n.severity !== severity) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return n.title.toLowerCase().includes(q) || (n.body ?? "").toLowerCase().includes(q) || n.type.includes(q);
    });
  }, [rows, query, severity]);

  const markRead = async (id: string) => {
    await supabase.from("admin_notifications").update({ read: true }).eq("id", id);
  };
  const markAllRead = async () => {
    await supabase.from("admin_notifications").update({ read: true }).eq("read", false);
  };

  return (
    <div className={variant === "popover" ? "w-[22rem] max-w-[90vw]" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notifications…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <button
          onClick={markAllRead}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
        >
          <Check className="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>

      <div className={`mt-3 grid gap-2 ${variant === "popover" ? "max-h-[60vh] overflow-y-auto" : ""}`}>
        {loading && <div className="surface-card p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="surface-card flex flex-col items-center gap-2 p-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">No notifications yet.</div>
          </div>
        )}
        {items.map((n) => {
          const meta = SEVERITY_META[n.severity] ?? SEVERITY_META.info;
          return (
            <div
              key={n.id}
              className={`surface-card flex items-start gap-3 p-3.5 transition-colors ${n.read ? "opacity-60" : ""}`}
            >
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.className}`}>
                {meta.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {n.type.replace(/_/g, " ")} · {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead(n.id)}
                  title="Mark as read"
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Bell button with a live unread badge. */
export function NotificationBell({ onClick }: { onClick: () => void }) {
  const { rows } = useRealtimeTable<AdminNotification>("admin_notifications", { limit: 200 });
  const unread = (rows ?? []).filter((n) => !n.read).length;
  return (
    <button
      onClick={onClick}
      className="relative rounded-xl border border-border p-2.5 transition-colors hover:bg-secondary"
      aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
    >
      <Bell className="h-4.5 w-4.5" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-5 text-destructive-foreground">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
