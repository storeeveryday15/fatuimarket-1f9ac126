import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Plus, Search, Pin, PinOff, Archive, ArchiveRestore, Trash2, Pencil, Download, ShieldOff, ShieldCheck } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  clearAllThreads,
  createThread,
  deleteThread,
  downloadText,
  exportThread,
  historyEnabled,
  listMessages,
  listThreads,
  setHistoryEnabled,
  updateThread,
  type ChatThread,
} from "@/lib/chat-threads";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chats/")({
  head: () => ({
    meta: [
      { title: "Recent Chats — Fatui AI | Fatui Market" },
      { name: "description", content: "Your saved Fatui AI conversations: game guides, event news, order help and top-up advice, synced across every device." },
      { property: "og:title", content: "Recent Chats — Fatui AI" },
      { property: "og:description", content: "Continue any Fatui AI conversation from any device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatsPage,
});

function ChatsPage() {
  const { ready, user } = useRequireAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [saving, setSaving] = useState(true);

  const load = useCallback(async () => {
    setThreads(await listThreads(showArchived));
  }, [showArchived]);

  useEffect(() => {
    if (!ready || !user) return;
    void load();
    void historyEnabled().then(setSaving);
  }, [ready, user, load]);

  // Live sync: new chats started on another device appear immediately.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("my-threads")
      .on("postgres_changes", { event: "*", schema: "public", table: "assistant_threads" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, load]);

  if (!ready || !user) return null;

  const startNew = async () => {
    const t = await createThread();
    if (!t) return toast.error("Could not start a new chat.");
    void navigate({ to: "/chats/$threadId", params: { threadId: t.id } });
  };

  const visible = threads.filter((t) =>
    query.trim() ? `${t.title} ${t.last_message ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  const rename = async (t: ChatThread) => {
    const title = window.prompt("Rename chat", t.title);
    if (!title?.trim()) return;
    await updateThread(t.id, { title: title.trim().slice(0, 60) });
    void load();
  };

  const remove = async (t: ChatThread) => {
    if (!window.confirm("Delete this chat permanently?")) return;
    await deleteThread(t.id);
    void load();
  };

  const exportOne = async (t: ChatThread) => {
    const msgs = await listMessages(t.id);
    downloadText(`fatui-ai-${t.id.slice(0, 8)}.txt`, exportThread(t, msgs));
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bot className="h-6 w-6 text-primary" /> Recent Chats
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every Fatui AI conversation, synced across your devices.
          </p>
        </div>
        <button
          onClick={() => void startNew()}
          className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your chats…"
            className="w-full rounded-xl border border-input bg-background/70 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="rounded-xl border border-input px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
        {saving ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldOff className="h-4 w-4 text-destructive" />}
        <span className="flex-1">
          {saving
            ? "Chat history is on — your conversations are saved privately to your account."
            : "Chat history is off — new conversations are not saved."}
        </span>
        <button
          onClick={async () => {
            await setHistoryEnabled(!saving);
            setSaving(!saving);
            toast.success(saving ? "Chat history disabled." : "Chat history enabled.");
          }}
          className="rounded-lg border border-input px-2.5 py-1 hover:text-foreground"
        >
          {saving ? "Turn off" : "Turn on"}
        </button>
        <button
          onClick={async () => {
            if (!window.confirm("Delete every saved chat? This cannot be undone.")) return;
            await clearAllThreads();
            void load();
            toast.success("All chats deleted.");
          }}
          className="rounded-lg border border-destructive/40 px-2.5 py-1 text-destructive"
        >
          Clear history
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-secondary/30 p-10 text-center text-sm text-muted-foreground">
          No chats yet. Start one and Fatui AI will remember it here.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 transition-colors hover:border-primary/40"
            >
              <Link
                to="/chats/$threadId"
                params={{ threadId: t.id }}
                className="min-w-0 flex-1"
              >
                <div className="flex items-center gap-2">
                  {t.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                  <span className="truncate font-semibold">{t.title}</span>
                  {t.archived && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">archived</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{t.last_message ?? "No messages yet"}</div>
              </Link>
              <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                {new Date(t.last_message_at).toLocaleDateString()}
              </span>
              <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <button onClick={() => void updateThread(t.id, { pinned: !t.pinned }).then(load)} aria-label={t.pinned ? "Unpin" : "Pin"} className="p-1 hover:text-foreground">
                  {t.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button onClick={() => void rename(t)} aria-label="Rename" className="p-1 hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => void updateThread(t.id, { archived: !t.archived }).then(load)} aria-label={t.archived ? "Unarchive" : "Archive"} className="p-1 hover:text-foreground">
                  {t.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </button>
                <button onClick={() => void exportOne(t)} aria-label="Export" className="p-1 hover:text-foreground">
                  <Download className="h-4 w-4" />
                </button>
                <button onClick={() => void remove(t)} aria-label="Delete" className="p-1 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
