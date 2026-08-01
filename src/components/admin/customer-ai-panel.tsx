import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Plus, Trash2, Save, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS } from "@/lib/products";

type Faq = { id: string; question: string; answer: string; category: string; active: boolean; sort_order: number };
type Stats = { total_chats: number; chats_today: number; positive: number; negative: number; satisfaction: number };

/**
 * Admin controls for the customer-facing Fatui AI assistant: on/off switch,
 * welcome message, extra instructions, supported games, custom FAQs and
 * usage statistics. All reads/writes go through RLS as the signed-in admin.
 */
export function CustomerAiPanel() {
  const [enabled, setEnabled] = useState(true);
  const [welcome, setWelcome] = useState("");
  const [instructions, setInstructions] = useState("");
  const [games, setGames] = useState<string[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [common, setCommon] = useState<Array<{ q: string; n: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ question: "", answer: "", category: "general" });

  const loadFaqs = async () => {
    const { data } = await supabase.from("assistant_faqs").select("*").order("sort_order");
    setFaqs((data ?? []) as Faq[]);
  };

  useEffect(() => {
    void (async () => {
      const [{ data: s }, { data: st }, { data: chats }] = await Promise.all([
        supabase.from("assistant_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.rpc("get_assistant_stats"),
        supabase.from("assistant_chats").select("question").order("created_at", { ascending: false }).limit(500),
      ]);
      if (s) {
        setEnabled(s.enabled);
        setWelcome(s.welcome_message ?? "");
        setInstructions(s.extra_instructions ?? "");
        setGames(s.supported_games ?? []);
      }
      const row = Array.isArray(st) ? (st[0] as Stats | undefined) : undefined;
      if (row) setStats(row);
      const counts = new Map<string, number>();
      for (const c of chats ?? []) {
        const k = (c.question ?? "").trim().toLowerCase().slice(0, 80);
        if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      setCommon(
        [...counts.entries()]
          .map(([q, n]) => ({ q, n }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 8),
      );
      await loadFaqs();
    })();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("assistant_settings")
      .update({
        enabled,
        welcome_message: welcome,
        extra_instructions: instructions || null,
        supported_games: games,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Assistant settings saved");
  };

  const addFaq = async () => {
    if (!draft.question.trim() || !draft.answer.trim()) return toast.error("Question and answer are required");
    const { error } = await supabase.from("assistant_faqs").insert({
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      category: draft.category.trim() || "general",
      sort_order: faqs.length,
    });
    if (error) return toast.error(error.message);
    setDraft({ question: "", answer: "", category: "general" });
    toast.success("FAQ added");
    await loadFaqs();
  };

  const toggleFaq = async (f: Faq) => {
    const { error } = await supabase.from("assistant_faqs").update({ active: !f.active }).eq("id", f.id);
    if (error) return toast.error(error.message);
    await loadFaqs();
  };

  const removeFaq = async (id: string) => {
    const { error } = await supabase.from("assistant_faqs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await loadFaqs();
  };

  const toggleGame = (slug: string) =>
    setGames((g) => (g.includes(slug) ? g.filter((x) => x !== slug) : [...g, slug]));

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-[var(--neon)]" />
        <h2 className="text-xl font-bold">Customer AI Assistant</h2>
      </div>

      {/* Statistics */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total chats", value: stats?.total_chats ?? 0 },
          { label: "Chats today", value: stats?.chats_today ?? 0 },
          { label: "👍 / 👎", value: `${stats?.positive ?? 0} / ${stats?.negative ?? 0}` },
          { label: "Satisfaction", value: `${stats?.satisfaction ?? 0}%` },
        ].map((s) => (
          <div key={s.label} className="surface-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="surface-card grid gap-3 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Assistant enabled on the storefront
        </label>
        <div className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Welcome message</span>
          <textarea
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            rows={2}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Extra instructions for the AI (optional)</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="e.g. Always mention the ongoing Diwali sale on MLBB packs."
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            Supported games (none selected = all games)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCTS.map((p) => (
              <button
                key={p.slug}
                onClick={() => toggleGame(p.slug)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  games.includes(p.slug)
                    ? "border-[var(--neon)] bg-[var(--neon)]/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Save settings
        </button>
      </div>

      {/* Custom FAQs */}
      <div className="surface-card grid gap-3 p-4">
        <h3 className="text-sm font-bold">Custom FAQs / Q&amp;A</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
          <input
            value={draft.question}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            placeholder="Question"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={draft.answer}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
            placeholder="Answer"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder="Category"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={addFaq}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="grid gap-2">
          {faqs.length === 0 && <p className="text-sm text-muted-foreground">No custom FAQs yet.</p>}
          {faqs.map((f) => (
            <div key={f.id} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {f.question} <span className="text-[10px] uppercase text-muted-foreground">· {f.category}</span>
                </div>
                <div className="text-muted-foreground">{f.answer}</div>
              </div>
              <button
                onClick={() => toggleFaq(f)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
                  f.active ? "border-[var(--neon)] text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {f.active ? "Active" : "Hidden"}
              </button>
              <button onClick={() => removeFaq(f.id)} aria-label="Delete FAQ" className="shrink-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Common questions */}
      <div className="surface-card grid gap-2 p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--neon)]" />
          <h3 className="text-sm font-bold">Most common customer questions</h3>
        </div>
        {common.length === 0 && <p className="text-sm text-muted-foreground">No chats logged yet.</p>}
        {common.map((c) => (
          <div key={c.q} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground">{c.q}</span>
            <span className="shrink-0 font-semibold">{c.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
