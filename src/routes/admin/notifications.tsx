import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Bell, ImagePlus, Megaphone, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NotificationCenter } from "@/components/admin/notification-center";
import { CampaignAnalytics } from "@/components/admin/campaign-analytics";
import { sendCustomerMessage } from "@/lib/admin-messaging.functions";
import { PLACEHOLDERS } from "@/lib/email/personalize";
import { PRODUCTS } from "@/lib/products";


export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Fatui Market Admin" },
      {
        name: "description",
        content: "Send announcements, schedule campaigns and monitor operational alerts for Fatui Market.",
      },
      { property: "og:title", content: "Notifications — Fatui Market Admin" },
      { property: "og:description", content: "Announcements, campaigns and operational alerts for Fatui Market admins." },
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

type Announcement = {
  id: string;
  type: string;
  title: string;
  description: string;
  image_url: string | null;
  target_games: string[];
  starts_at: string;
  status: string;
  send_email: boolean;
  created_at: string;
  email_status?: string;
  email_sent_count?: number;
  email_failed_count?: number;
  email_error?: string | null;
  inapp_count?: number;
};

const SELECT_COLS =
  "id,type,title,description,image_url,target_games,starts_at,status,send_email,created_at,email_status,email_sent_count,email_failed_count,email_error,inapp_count";


function NotificationsPage() {
  const [tab, setTab] = useState<"compose" | "analytics" | "alerts">("compose");
  const tabCls = (active: boolean) =>
    `px-3 py-2 text-sm font-semibold ${active ? "border-b-2 border-[var(--neon)] text-foreground" : "text-muted-foreground"}`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-border">
        <button onClick={() => setTab("compose")} className={tabCls(tab === "compose")}>
          <Megaphone className="mr-1.5 inline h-4 w-4" /> Announcements
        </button>
        <button onClick={() => setTab("analytics")} className={tabCls(tab === "analytics")}>
          <BarChart3 className="mr-1.5 inline h-4 w-4" /> Email analytics
        </button>
        <button onClick={() => setTab("alerts")} className={tabCls(tab === "alerts")}>
          <Bell className="mr-1.5 inline h-4 w-4" /> System alerts
        </button>
      </div>
      {tab === "compose" ? <Composer /> : tab === "analytics" ? <CampaignAnalytics /> : <NotificationCenter />}
    </div>
  );
}


function Composer() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [game, setGame] = useState("all");
  const [scheduleAt, setScheduleAt] = useState("");
  const [email, setEmail] = useState(false);
  const [inApp, setInApp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [list, setList] = useState<Announcement[]>([]);

  /** Downscales to max 1200px wide and uploads to the announcements bucket. */
  const uploadBanner = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8 MB");
    setUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
      if (!blob) throw new Error("Could not process image");
      const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage
        .from("announcements")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(error.message);
      setImageUrl(`https://fatuimarket.shop/api/public/announcement-image?p=${encodeURIComponent(path)}`);
      toast.success("Banner uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const insertPlaceholder = (token: string) => {
    const el = bodyRef.current;
    if (!el) return setDescription((d) => d + token);
    const start = el.selectionStart ?? description.length;
    const end = el.selectionEnd ?? description.length;
    setDescription(description.slice(0, start) + token + description.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const send = useServerFn(sendCustomerMessage);

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(30);
    setList((data ?? []) as unknown as Announcement[]);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  // Deliver any scheduled announcement whose time has come.
  useEffect(() => {
    const due = list.filter((a) => a.status === "scheduled" && new Date(a.starts_at) <= new Date());
    if (!due.length) return;
    void (async () => {
      for (const a of due) await deliver(a);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const deliver = async (a: Announcement) => {
    try {
      const res = await send({
        data: {
          title: a.title,
          body: a.description,
          image_url: a.image_url,
          link: link || null,
          game_slug: a.target_games?.[0] && a.target_games[0] !== "all" ? a.target_games[0] : null,
          email: a.send_email,
          announcement_id: a.id,
        },
      });

      const emailStatus = !a.send_email
        ? "not_sent"
        : res.failed > 0 && res.emails === 0
          ? "failed"
          : res.failed > 0
            ? "partial"
            : "queued";

      await supabase
        .from("announcements")
        .update({
          status: emailStatus === "failed" ? "failed" : "sent",
          emailed_at: res.emails ? new Date().toISOString() : null,
          email_status: emailStatus,
          email_sent_count: res.emails,
          email_failed_count: res.failed,
          email_error: res.errors.length ? res.errors.slice(0, 3).join(" · ") : null,
          inapp_count: res.inApp,
        })
        .eq("id", a.id);

      if (a.send_email && res.emails === 0 && res.failed > 0) {
        toast.error(`Emails failed: ${res.errors[0] ?? "unknown error"}`);
      } else {
        toast.success(
          `In-app: ${res.inApp}${a.send_email ? ` · emails queued: ${res.emails}` : ""}` +
            (res.failed ? ` · failed: ${res.failed}` : "") +
            (res.skipped ? ` · skipped: ${res.skipped}` : ""),
        );
      }
      void load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delivery failed";
      await supabase
        .from("announcements")
        .update({ status: "failed", email_status: "failed", email_error: msg })
        .eq("id", a.id);
      toast.error(msg);
      void load();
    }
  };


  const submit = async () => {
    if (!title.trim() || !description.trim()) return toast.error("Add a title and message");
    setBusy(true);
    const startsAt = scheduleAt ? new Date(scheduleAt).toISOString() : new Date().toISOString();
    const scheduled = Boolean(scheduleAt) && new Date(scheduleAt) > new Date();
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        type: "announcement",
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl.trim() || null,
        button_link: link.trim() || null,
        target_games: game === "all" ? ["all"] : [game],
        placements: ["home"],
        starts_at: startsAt,
        status: scheduled ? "scheduled" : "active",
        send_email: email,
      })
      .select(SELECT_COLS)
      .single();
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Could not save announcement");
    toast.success(scheduled ? "Announcement scheduled" : "Announcement created");
    setTitle(""); setDescription(""); setImageUrl(""); setLink(""); setScheduleAt("");
    if (!scheduled && inApp) await deliver(data as Announcement);
    void load();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="surface-card space-y-3 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">New announcement</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <textarea ref={bodyRef} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Message to customers" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Personalize:</span>
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.token}
              type="button"
              onClick={() => insertPlaceholder(p.token)}
              title={`Inserts ${p.label}`}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary"
            >
              {p.token}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-dashed border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <ImagePlus className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload banner"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture={undefined}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadBanner(f); e.target.value = ""; }}
            />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="…or paste an image URL"
              className="min-w-[180px] flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs"
            />
            {imageUrl && (
              <button type="button" onClick={() => setImageUrl("")} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {imageUrl && (
            <img src={imageUrl} alt="Banner preview" className="mt-3 max-h-40 w-full rounded-lg object-cover" loading="lazy" />
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">JPG/PNG up to 8 MB — resized automatically. On mobile you can pick from camera or gallery.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (optional)" className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <select value={game} onChange={(e) => setGame(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="all">All customers</option>
            {PRODUCTS.map((p) => <option key={p.slug} value={p.slug}>{p.name} players</option>)}
          </select>
          <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-2"><input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} /> In-app notification</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email</label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Customers who turned off announcements or email in their preferences are skipped automatically.
        </p>
        <button onClick={() => void submit()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[var(--neon)]/15 px-4 py-2 text-sm font-semibold text-[var(--neon)] disabled:opacity-50">
          <Send className="h-4 w-4" /> {busy ? "Saving…" : scheduleAt ? "Schedule" : "Send now"}
        </button>
      </div>

      <div className="surface-card p-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent announcements</h3>
        <ul className="mt-3 divide-y divide-border">
          {list.map((a) => (
            <li key={a.id} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{a.title}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    a.status === "failed" || a.email_status === "failed"
                      ? "bg-destructive/15 text-destructive"
                      : a.email_status === "partial"
                        ? "bg-yellow-500/15 text-yellow-500"
                        : "bg-secondary"
                  }`}
                >
                  {a.status === "failed" || a.email_status === "failed"
                    ? "failed"
                    : a.email_status === "partial"
                      ? "partial"
                      : a.status}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
              {a.send_email && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Email: {a.email_status ?? "not sent"} · queued {a.email_sent_count ?? 0}
                  {a.email_failed_count ? ` · failed ${a.email_failed_count}` : ""}
                  {a.inapp_count ? ` · in-app ${a.inapp_count}` : ""}
                </p>
              )}
              {a.email_error && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-destructive">{a.email_error}</p>
              )}
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{new Date(a.starts_at).toLocaleString()}</span>
                <button onClick={() => void deliver(a)} className="rounded-md border border-border px-2 py-0.5">
                  {a.status === "sent" ? "Resend" : "Send now"}
                </button>
                <button onClick={async () => { await supabase.from("announcements").delete().eq("id", a.id); void load(); }} className="rounded-md border border-border px-2 py-0.5">Delete</button>
              </div>
            </li>
          ))}

          {list.length === 0 && <li className="py-3 text-xs text-muted-foreground">No announcements yet.</li>}
        </ul>
      </div>
    </div>
  );
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
