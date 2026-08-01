import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Instagram, RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { askFatuiAssistant } from "@/lib/assistant.functions";
import { WHATSAPP_LINK, INSTAGRAM_LINK, TELEGRAM_LINK } from "@/lib/products";

type Msg = { role: "bot" | "user"; text: string };

const GREETING: Msg = {
  role: "bot",
  text: "Hi! I'm Fatui AI ✨ — ask me about any game top-up, prices, delivery, wallet, refunds or the latest in-game events.",
};

const QUICK = [
  "How long does delivery take?",
  "What do I need for a Mobile Legends top-up?",
  "What's new in Genshin Impact?",
  "Refund policy",
  "Talk to a human",
];

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


// Brand icons (inline SVG for accurate look)
const WhatsAppIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.02 0C5.5 0 .2 5.3.2 11.82c0 2.08.55 4.11 1.6 5.9L0 24l6.45-1.69a11.8 11.8 0 0 0 5.57 1.42h.01c6.52 0 11.82-5.3 11.82-11.82 0-3.16-1.23-6.13-3.33-8.43ZM12.03 21.3h-.01a9.47 9.47 0 0 1-4.83-1.32l-.35-.21-3.83 1 1.02-3.73-.23-.38a9.47 9.47 0 0 1-1.46-5.05c0-5.24 4.27-9.5 9.5-9.5 2.54 0 4.93.99 6.72 2.79a9.44 9.44 0 0 1 2.78 6.72c0 5.24-4.27 9.5-9.5 9.5Zm5.2-7.11c-.28-.14-1.68-.83-1.94-.92-.26-.1-.45-.14-.64.14-.19.28-.74.92-.9 1.11-.17.19-.33.21-.61.07-.28-.14-1.2-.44-2.28-1.4-.84-.75-1.4-1.68-1.57-1.96-.16-.28-.02-.43.12-.57.12-.12.28-.33.42-.49.14-.16.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.64-1.54-.87-2.11-.23-.55-.46-.48-.64-.49-.16-.01-.35-.01-.54-.01-.19 0-.5.07-.76.35-.26.28-1 .98-1 2.38 0 1.41 1.02 2.77 1.16 2.96.14.19 2.02 3.08 4.89 4.32.68.29 1.22.47 1.63.6.68.22 1.31.19 1.8.11.55-.08 1.68-.69 1.92-1.36.24-.67.24-1.24.17-1.36-.07-.11-.26-.19-.54-.33Z"/>
  </svg>
);

const TelegramIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0Zm5.7 8.2-1.9 9c-.14.64-.52.8-1.05.5l-2.9-2.14-1.4 1.35c-.16.16-.29.29-.58.29l.2-2.94 5.35-4.83c.23-.2-.05-.32-.36-.12L9.4 13.13l-2.85-.9c-.62-.2-.63-.62.13-.92l11.13-4.29c.52-.19.97.13.8.98Z"/>
  </svg>
);

type Orbit = {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  color: string; // gradient css
  glow: string;
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ask = useServerFn(askFatuiAssistant);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, chatOpen]);

  useEffect(() => {
    if (chatOpen && !busy) inputRef.current?.focus();
  }, [chatOpen, busy]);

  // Close orbital menu on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);

    try {
      const orderContext = await ownOrderContext().catch(() => undefined);
      const history = next
        .filter((m) => m !== GREETING)
        .slice(-16)
        .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
      const { reply } = await ask({ data: { messages: history, orderContext } });
      setMsgs((m) => [...m, { role: "bot", text: reply }]);
    } catch (err) {
      console.error("[ChatWidget] assistant failed", err);
      setMsgs((m) => [
        ...m,
        {
          role: "bot",
          text: `${err instanceof Error ? err.message : "Something went wrong."} You can also reach a human here: ${WHATSAPP_LINK}`,
        },
      ]);
    } finally {
      setBusy(false);
    }

    if (/human|agent|support|paid|refund|issue|problem/i.test(q)) {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("support_messages").insert({
        user_id: u.user?.id ?? null,
        name: u.user?.email ?? "Guest",
        contact: u.user?.email ?? null,
        message: q,
      });
    }
  };


  const orbits: Orbit[] = [
    {
      key: "whatsapp",
      label: "WhatsApp Support",
      href: WHATSAPP_LINK,
      icon: <WhatsAppIcon />,
      color: "linear-gradient(135deg,#25D366,#128C7E)",
      glow: "0 0 18px rgba(37,211,102,.55)",
    },
    {
      key: "tg-channel",
      label: "Telegram Channel",
      href: TELEGRAM_LINK,
      icon: <TelegramIcon />,
      color: "linear-gradient(135deg,#29B6F6,#0088CC)",
      glow: "0 0 18px rgba(0,136,204,.55)",
    },
    {
      key: "tg-community",
      label: "Telegram Community",
      href: TELEGRAM_LINK,
      icon: <Send className="h-5 w-5" />,
      color: "linear-gradient(135deg,#5EEAD4,#0EA5E9)",
      glow: "0 0 18px rgba(14,165,233,.55)",
    },
    {
      key: "instagram",
      label: "Instagram",
      href: INSTAGRAM_LINK,
      icon: <Instagram className="h-5 w-5" />,
      color: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)",
      glow: "0 0 18px rgba(221,42,123,.55)",
    },
    {
      key: "livechat",
      label: "Live Chat",
      onClick: () => {
        setChatOpen(true);
        setOpen(false);
      },
      icon: <MessageCircle className="h-5 w-5" />,
      color: "linear-gradient(135deg,#8B5CF6,#3B82F6)",
      glow: "0 0 18px rgba(139,92,246,.6)",
    },
  ];

  // Quarter-circle arc: angles from 10° to 80° (from +x axis, going up)
  const RADIUS = 120;
  const startDeg = 10;
  const endDeg = 82;
  const step = (endDeg - startDeg) / (orbits.length - 1);

  return (
    <>
      {/* Orbital menu */}
      <div
        ref={wrapRef}
        className="pointer-events-none fixed bottom-5 left-5 z-40"
        style={{ width: 56, height: 56 }}
      >
        {/* Orbital rings */}
        <div
          aria-hidden
          className={`absolute left-1/2 top-1/2 pointer-events-none transition-all duration-500 ${
            open ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            width: RADIUS * 2 * 0.55,
            height: RADIUS * 2 * 0.55,
            transform: "translate(-50%,-50%)",
          }}
        >
          <div className="absolute inset-0 rounded-full border border-primary/25 animate-[spin_18s_linear_infinite]" style={{ boxShadow: "0 0 20px rgba(139,92,246,.15) inset" }} />
        </div>
        <div
          aria-hidden
          className={`absolute left-1/2 top-1/2 pointer-events-none transition-all duration-700 ${
            open ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            width: RADIUS * 2 * 0.85,
            height: RADIUS * 2 * 0.85,
            transform: "translate(-50%,-50%)",
          }}
        >
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-[spin_28s_linear_infinite_reverse]" style={{ boxShadow: "0 0 24px rgba(59,130,246,.12) inset" }} />
        </div>
        <div
          aria-hidden
          className={`absolute left-1/2 top-1/2 pointer-events-none transition-all duration-1000 ${
            open ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          style={{
            width: RADIUS * 2 * 1.15,
            height: RADIUS * 2 * 1.15,
            transform: "translate(-50%,-50%)",
          }}
        >
          <div className="absolute inset-0 rounded-full border border-primary/15 animate-[spin_40s_linear_infinite]" style={{ boxShadow: "0 0 30px rgba(139,92,246,.08) inset" }} />
        </div>

        {/* Orbiting buttons */}
        {orbits.map((o, i) => {
          const angle = startDeg + step * i;
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * RADIUS;
          const y = -Math.sin(rad) * RADIUS; // negative Y = up
          const delay = i * 55;
          return (
            <div
              key={o.key}
              className="pointer-events-auto absolute left-1/2 top-1/2"
              style={{
                transform: open
                  ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                  : `translate(-50%,-50%) scale(.4)`,
                opacity: open ? 1 : 0,
                transition: `transform 520ms cubic-bezier(.34,1.56,.64,1) ${delay}ms, opacity 300ms ease ${delay}ms`,
                pointerEvents: open ? "auto" : "none",
              }}
            >
              <div className="group relative flex items-center">
                {o.href ? (
                  <a
                    href={o.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={o.label}
                    className="grid h-12 w-12 place-items-center rounded-full text-white transition-transform hover:scale-110 active:scale-95"
                    style={{ background: o.color, boxShadow: o.glow }}
                  >
                    {o.icon}
                  </a>
                ) : (
                  <button
                    onClick={o.onClick}
                    aria-label={o.label}
                    className="grid h-12 w-12 place-items-center rounded-full text-white transition-transform hover:scale-110 active:scale-95"
                    style={{ background: o.color, boxShadow: o.glow }}
                  >
                    {o.icon}
                  </button>
                )}
                {/* Tooltip */}
                <span
                  className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-primary/30 bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-[0_0_14px_rgba(139,92,246,.35)] backdrop-blur transition-opacity group-hover:opacity-100"
                >
                  {o.label}
                </span>
              </div>
            </div>
          );
        })}

        {/* Center button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close support menu" : "Open support menu"}
          aria-expanded={open}
          className="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-full text-primary-foreground transition-all"
          style={{
            background: "var(--gradient-primary)",
            boxShadow: open
              ? "0 0 30px rgba(139,92,246,.75), 0 0 60px rgba(59,130,246,.35)"
              : "0 0 22px rgba(139,92,246,.55), 0 0 44px rgba(59,130,246,.25)",
          }}
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(closest-side, rgba(255,255,255,.25), transparent 70%)",
            }}
          />
          <span
            className="absolute inset-0 grid place-items-center transition-all duration-300"
            style={{
              opacity: open ? 0 : 1,
              transform: open ? "rotate(-90deg) scale(.6)" : "rotate(0) scale(1)",
            }}
          >
            <MessageCircle className="h-6 w-6" />
          </span>
          <span
            className="absolute inset-0 grid place-items-center transition-all duration-300"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "rotate(0) scale(1)" : "rotate(90deg) scale(.6)",
            }}
          >
            <X className="h-6 w-6" />
          </span>
        </button>
      </div>

      {/* Live Chat panel */}
      {chatOpen && (
        <div className="fixed bottom-24 left-5 z-50 flex h-[min(540px,80vh)] w-[min(360px,92vw)] flex-col rounded-2xl border border-border bg-card shadow-2xl animate-scale-in">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Fatui AI Assistant</div>
              <div className="text-[11px] text-success">● online · answers instantly</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMsgs([GREETING])}
                aria-label="New chat"
                title="New chat"
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {m.text.split(/(\bhttps?:\/\/\S+)/g).map((part, j) =>
                    part.startsWith("http") ? (
                      <a key={j} href={part} target="_blank" rel="noreferrer" className="underline">
                        {part}
                      </a>
                    ) : (
                      <span key={j}>{part}</span>
                    )
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t border-border px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
