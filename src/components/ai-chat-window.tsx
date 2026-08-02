import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Bot, Paperclip, X, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { askFatuiAssistant, generateChatTitle } from "@/lib/assistant.functions";
import {
  cacheMessages,
  cachedMessages,
  listMessages,
  saveMessage,
  updateThread,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/chat-threads";

const time = (t: string) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Pulls the signed-in customer's own recent orders (RLS-scoped) for context. */
async function ownOrderContext(): Promise<string | undefined> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return undefined;
  const { data } = await supabase
    .from("orders")
    .select("order_code,product_name,tier_label,status,server_region,created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  if (!data?.length) return undefined;
  return data
    .map(
      (o) =>
        `${o.order_code}: ${o.product_name} ${o.tier_label} — ${o.status}${o.server_region ? ` (${o.server_region})` : ""} on ${new Date(o.created_at).toLocaleDateString()}`,
    )
    .join("\n");
}

function Linkify({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\bhttps?:\/\/\S+)/g).map((part, j) =>
        part.startsWith("http") ? (
          <a key={j} href={part} target="_blank" rel="noreferrer" className="underline">
            {part}
          </a>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </>
  );
}

export function AiChatWindow({ threadId, autoTitle }: { threadId: string; autoTitle?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => cachedMessages(threadId));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ask = useServerFn(askFatuiAssistant);
  const titleFn = useServerFn(generateChatTitle);

  useEffect(() => {
    setMessages(cachedMessages(threadId));
    void listMessages(threadId).then(setMessages);
  }, [threadId]);

  // Real-time sync across the customer's other devices.
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "assistant_thread_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as unknown as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    cacheMessages(threadId, messages);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, threadId]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, threadId]);

  const upload = useCallback(async (files: FileList) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    for (const file of Array.from(files).slice(0, 3)) {
      const path = `${u.user.id}/${threadId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
      if (error) {
        console.error("[chat] upload failed", error);
        continue;
      }
      const { data: signed } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) setPending((p) => [...p, { url: signed.signedUrl, name: file.name, type: file.type }]);
    }
  }, [threadId]);

  const send = async (raw: string) => {
    const q = raw.trim();
    if ((!q && !pending.length) || busy) return;
    const attachments = pending;
    setInput("");
    setPending([]);
    setBusy(true);

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      thread_id: threadId,
      role: "user",
      content: q,
      attachments,
      sources: [],
      created_at: new Date().toISOString(),
    };
    const history = [...messages, optimistic];
    setMessages(history);
    void saveMessage(threadId, "user", q, { attachments });

    if (autoTitle && messages.length === 0 && q) {
      void titleFn({ data: { text: q } }).then((r) => updateThread(threadId, { title: r.title }));
    }

    try {
      const orderContext = await ownOrderContext().catch(() => undefined);
      const payload = history
        .slice(-16)
        .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content }))
        .filter((m) => m.content.length > 0);
      const { reply, sources } = await ask({ data: { messages: payload, orderContext } });
      const saved = await saveMessage(threadId, "assistant", reply, { sources });
      setMessages((prev) =>
        prev.some((m) => saved && m.id === saved.id)
          ? prev
          : [
              ...prev,
              saved ?? {
                id: `local-a-${Date.now()}`,
                thread_id: threadId,
                role: "assistant",
                content: reply,
                attachments: [],
                sources,
                created_at: new Date().toISOString(),
              },
            ],
      );
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          thread_id: threadId,
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
          attachments: [],
          sources: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-secondary/40 p-5 text-center text-sm text-muted-foreground">
            <Bot className="mx-auto mb-2 h-7 w-7 text-primary" />
            Ask me anything — live events and banners, redeem codes, patch notes, tier lists and builds, or your Fatui
            Market orders, wallet and prices.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                  : "border border-border/60 bg-secondary/70 text-foreground backdrop-blur"
              }`}
            >
              {m.attachments?.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {m.attachments.map((a, i) =>
                    a.type?.startsWith("image/") ? (
                      <img key={i} src={a.url} alt={a.name} loading="lazy" className="max-h-40 rounded-lg border border-border/50" />
                    ) : (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" className="text-xs underline">
                        {a.name}
                      </a>
                    ),
                  )}
                </div>
              )}
              <div className="whitespace-pre-wrap">
                <Linkify text={m.content} />
              </div>
            </div>
            {m.role === "assistant" && m.sources?.length > 0 && (
              <div className="mt-1.5 flex max-w-[85%] flex-wrap gap-1.5">
                {m.sources.slice(0, 5).map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    title={s.title}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                      s.trust === "official"
                        ? "border-success/40 text-success"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    {s.trust === "official" ? <ShieldCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                    {new URL(s.url).hostname.replace(/^www\./, "")}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-1 px-1 text-[10px] text-muted-foreground">{time(m.created_at)}</div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl border border-border/60 bg-secondary/70 px-3 py-2.5 backdrop-blur">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  style={{ animation: `pulse 1s ease-in-out ${d * 0.18}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border/60 px-3 py-2.5 sm:px-5">
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11px]">
                {a.name}
                <button type="button" onClick={() => setPending((p) => p.filter((_, j) => j !== i))} aria-label="Remove attachment">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-input text-muted-foreground hover:text-foreground">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => e.target.files && void upload(e.target.files)}
            />
            <span className="sr-only">Attach a screenshot or receipt</span>
          </label>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask about games, events, codes, prices or your orders…"
            className="max-h-32 flex-1 resize-none rounded-xl border border-input bg-background/70 px-3 py-2.5 text-sm outline-none backdrop-blur focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
