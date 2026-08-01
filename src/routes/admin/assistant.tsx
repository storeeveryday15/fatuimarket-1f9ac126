import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { askAdminAssistant, generateAiReport } from "@/lib/admin.functions";
import { Bot, Send, FileText } from "lucide-react";
import { CustomerAiPanel } from "@/components/admin/customer-ai-panel";

export const Route = createFileRoute("/admin/assistant")({ component: AssistantPage });

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How did revenue and profit trend this week?",
  "Which products should I promote right now?",
  "Which products have unhealthy margins?",
  "Is there any unusual activity in recent orders?",
];

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await askAdminAssistant({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant failed");
      setMessages(next);
    } finally { setBusy(false); }
  };

  const report = async () => {
    setBusy(true);
    try {
      const row = await generateAiReport({});
      setMessages((m) => [...m, { role: "assistant", content: (row as { content: string }).content }]);
      toast.success("Daily report generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Report failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[var(--neon)]" />
          <h2 className="text-xl font-bold">AI Operations Analyst</h2>
        </div>
        <button onClick={report} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
          <FileText className="h-4 w-4" /> Generate daily report
        </button>
      </div>

      {messages.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="surface-card p-3 text-left text-sm hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">{s}</button>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`surface-card p-4 text-sm ${m.role === "user" ? "border-[var(--neon)]/30" : ""}`}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.role === "user" ? "You" : "Analyst"}</div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
        {busy && <div className="surface-card p-4 text-sm text-muted-foreground">Analysing live business data…</div>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="sticky bottom-4 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about orders, revenue, margins, suppliers…" className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm" />
        <button disabled={busy} className="rounded-xl bg-[image:var(--gradient-primary)] px-4 text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </form>

      <div className="mt-6 border-t border-border pt-6">
        <CustomerAiPanel />
      </div>
    </div>
  );
}
