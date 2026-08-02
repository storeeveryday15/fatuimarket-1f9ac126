import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Bot, Paperclip, X, ExternalLink, ShieldCheck, Users, ImagePlus, Download } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { askFatuiAssistant, generateChatTitle } from "@/lib/assistant.functions";
import {
  isSignedIn,
  storeCacheMessages,
  storeCachedMessages,
  storeListMessages,
  storeSaveMessage,
  storeUpdateThread,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/chat-store";
import { IMAGE_STYLES, streamImage, type ImageStyle } from "@/lib/stream-image";

const time = (t: string) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_GUEST_INLINE = 4 * 1024 * 1024; // guests keep uploads in the browser only

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

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
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
  const [messages, setMessages] = useState<ChatMessage[]>(() => storeCachedMessages(threadId));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [style, setStyle] = useState<ImageStyle>("anime");
  const [preview, setPreview] = useState<{ url: string; final: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ask = useServerFn(askFatuiAssistant);
  const titleFn = useServerFn(generateChatTitle);

  useEffect(() => {
    void isSignedIn().then(setSignedIn);
  }, []);

  useEffect(() => {
    setMessages(storeCachedMessages(threadId));
    void storeListMessages(threadId).then((rows) => {
      if (rows.length) setMessages(rows);
    });
  }, [threadId]);

  // Real-time sync across the customer's other devices (cloud history only).
  useEffect(() => {
    if (!signedIn) return;
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
  }, [threadId, signedIn]);

  useEffect(() => {
    storeCacheMessages(threadId, messages);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, threadId]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, threadId]);

  const upload = useCallback(
    async (files: FileList) => {
      setNote(null);
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;

      for (const file of Array.from(files).slice(0, 3)) {
        const isVideo = file.type.startsWith("video/");
        const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.size > limit) {
          setNote(`${file.name} is too large — images can be up to 20 MB and videos up to 100 MB.`);
          continue;
        }

        if (!user) {
          if (file.size > MAX_GUEST_INLINE) {
            setNote("Large uploads need an account. Sign in to attach files over 4 MB.");
            continue;
          }
          try {
            const url = await readAsDataUrl(file);
            setPending((p) => [...p, { url, name: file.name, type: file.type }]);
          } catch {
            setNote("That file could not be read.");
          }
          continue;
        }

        const path = `${user.id}/${threadId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("chat-uploads").upload(path, file);
        if (error) {
          console.error("[chat] upload failed", error);
          setNote("Upload failed — please try again.");
          continue;
        }
        const { data: signed } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) setPending((p) => [...p, { url: signed.signedUrl, name: file.name, type: file.type }]);
      }
    },
    [threadId],
  );

  const appendAssistant = async (content: string, extra?: Parameters<typeof storeSaveMessage>[3]) => {
    const saved = await storeSaveMessage(threadId, "assistant", content, extra);
    setMessages((prev) =>
      saved && prev.some((m) => m.id === saved.id)
        ? prev
        : [
            ...prev,
            saved ?? {
              id: `local-a-${Date.now()}`,
              thread_id: threadId,
              role: "assistant",
              content,
              attachments: extra?.attachments ?? [],
              sources: extra?.sources ?? [],
              created_at: new Date().toISOString(),
            },
          ],
    );
  };

  /** Stores a generated PNG so signed-in customers keep it in their history. */
  const persistGenerated = async (dataUrl: string): Promise<ChatAttachment> => {
    const name = `fatui-ai-${Date.now()}.png`;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { url: dataUrl, name, type: "image/png" };
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${u.user.id}/${threadId}/${name}`;
      const { error } = await supabase.storage.from("chat-uploads").upload(path, blob, { contentType: "image/png" });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
      return { url: signed?.signedUrl ?? dataUrl, name, type: "image/png" };
    } catch (err) {
      console.error("[chat] could not store generated image", err);
      return { url: dataUrl, name, type: "image/png" };
    }
  };

  const runImage = async (prompt: string) => {
    const source = pending.find((p) => p.type?.startsWith("image/"));
    const mode = source ? "edit" : "generate";
    setPending([]);
    setBusy(true);
    setPreview(null);

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      thread_id: threadId,
      role: "user",
      content: (mode === "edit" ? "Edit this image: " : "Create an image: ") + prompt,
      attachments: source ? [source] : [],
      sources: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    void storeSaveMessage(threadId, "user", optimistic.content, { attachments: optimistic.attachments });

    try {
      const image = source?.url.startsWith("data:")
        ? source.url
        : source
          ? await fetch(source.url)
              .then((r) => r.blob())
              .then(readAsDataUrl)
          : undefined;

      const result = await streamImage({ prompt, style, mode, image }, (url, final) => setPreview({ url, final }));
      setPreview(null);
      if (result.kind === "blocked") {
        await appendAssistant(`${result.reason}\n\nHere's a safe alternative you could try instead:\n"${result.alternative}"`);
      } else {
        const attachment = await persistGenerated(result.dataUrl);
        await appendAssistant(
          mode === "edit" ? "Here's the edited image." : "Here's your image — tap it to open full size.",
          { attachments: [attachment] },
        );
      }
    } catch (err) {
      setPreview(null);
      await appendAssistant(err instanceof Error ? err.message : "The image could not be created. Try rewording it.");
    } finally {
      setBusy(false);
    }
  };

  const send = async (raw: string) => {
    const q = raw.trim();
    if ((!q && !pending.length) || busy) return;

    if (imageMode) {
      if (!q) {
        setNote("Describe the image you want and I'll create it.");
        return;
      }
      setInput("");
      if (autoTitle && messages.length === 0) {
        void titleFn({ data: { text: q } }).then((r) => storeUpdateThread(threadId, { title: r.title }));
      }
      await runImage(q);
      return;
    }

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
    void storeSaveMessage(threadId, "user", q, { attachments });

    if (autoTitle && messages.length === 0 && q) {
      void titleFn({ data: { text: q } }).then((r) => storeUpdateThread(threadId, { title: r.title }));
    }

    try {
      const orderContext = await ownOrderContext().catch(() => undefined);
      const payload = history
        .slice(-16)
        .map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
          attachments: (m.attachments ?? [])
            .filter((a) => a.url)
            .slice(0, 4)
            .map((a) => ({ url: a.url, name: a.name, type: a.type })),
        }))
        .filter((m) => m.content.length > 0 || m.attachments.length > 0);
      const { reply, sources } = await ask({ data: { messages: payload, orderContext } });
      await appendAssistant(reply, { sources });
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
            Ask me anything — live events and codes, patch notes, builds, your orders and prices. You can also send a
            screenshot or receipt for me to read, or switch on image mode to create wallpapers, avatars and banners.
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
                    !a.url ? (
                      <span key={i} className="text-xs italic opacity-70">
                        {a.name} (not kept on this device)
                      </span>
                    ) : a.type?.startsWith("image/") ? (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" className="relative block">
                        <img src={a.url} alt={a.name} loading="lazy" className="max-h-52 rounded-lg border border-border/50" />
                        <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-md bg-background/80 text-foreground">
                          <Download className="h-3.5 w-3.5" />
                        </span>
                      </a>
                    ) : a.type?.startsWith("video/") ? (
                      <video key={i} src={a.url} controls className="max-h-52 rounded-lg border border-border/50" />
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

        {preview && (
          <div className="flex justify-start">
            <img
              src={preview.url}
              alt="Generating"
              className={`max-h-64 rounded-xl border border-border/60 transition-[filter] duration-500 ${
                preview.final ? "blur-0" : "blur-xl"
              }`}
            />
          </div>
        )}

        {busy && !preview && (
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
        {note && <div className="mb-2 text-[11px] text-destructive">{note}</div>}

        {imageMode && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {IMAGE_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  style === s.id ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

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
              accept="image/*,video/*,.pdf"
              className="hidden"
              onChange={(e) => e.target.files && void upload(e.target.files)}
            />
            <span className="sr-only">Attach a screenshot, photo or short video</span>
          </label>
          <button
            type="button"
            onClick={() => setImageMode((v) => !v)}
            aria-pressed={imageMode}
            title={imageMode ? "Switch back to chat" : "Create or edit an image"}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
              imageMode ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImagePlus className="h-4 w-4" />
            <span className="sr-only">Image mode</span>
          </button>
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
            placeholder={
              imageMode
                ? pending.length
                  ? "Describe the edit — remove background, add text, upscale…"
                  : "Describe the image to create — wallpaper, avatar, banner…"
                : "Ask about games, events, codes, prices or your orders…"
            }
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
