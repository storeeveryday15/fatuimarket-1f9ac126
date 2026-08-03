import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PlatformSettings } from "@/lib/admin/types";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Fatui Market Admin" },
      { name: "description", content: "Pricing rules, automation and alert settings for the Fatui Market store." },
      { property: "og:title", content: "Settings — Fatui Market Admin" },
      { property: "og:description", content: "Pricing rules, automation and alert settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (data) setS(data as PlatformSettings);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  if (!s) return <div className="surface-card p-8 text-sm text-muted-foreground">Loading settings…</div>;

  const set = (patch: Partial<PlatformSettings>) => setS({ ...s, ...patch });

  const save = async () => {
    setSaving(true);
    const { id, updated_at, ...rest } = s;
    void updated_at;
    const { error } = await supabase.from("platform_settings").update(rest).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-xs text-muted-foreground">Pricing rules and automation used by the Price Engine.</p>
      </div>

      <div className="surface-card grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Minimum profit (₹)"><NumberInput value={s.min_profit_inr} onChange={(v) => set({ min_profit_inr: v })} /></Field>
        <Field label="Maximum profit (₹)"><NumberInput value={s.max_profit_inr} onChange={(v) => set({ max_profit_inr: v })} /></Field>
        <Field label="Minimum margin (%)"><NumberInput value={s.min_profit_pct} onChange={(v) => set({ min_profit_pct: v })} /></Field>
        <Field label="Maximum margin (%)"><NumberInput value={s.max_profit_pct} onChange={(v) => set({ max_profit_pct: v })} /></Field>
        <Field label="Price rounding">
          <select value={s.price_rounding} onChange={(e) => set({ price_rounding: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {["none", "nearest_1", "nearest_5", "nearest_10", "charm_9"].map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Auto-pricing mode">
          <select value={s.auto_pricing_mode} onChange={(e) => set({ auto_pricing_mode: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {["manual", "suggest", "auto"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Low wallet alert (₹)"><NumberInput value={s.low_wallet_threshold_inr} onChange={(v) => set({ low_wallet_threshold_inr: v })} /></Field>
        <Field label="Low profit alert (₹)"><NumberInput value={s.low_profit_threshold_inr} onChange={(v) => set({ low_profit_threshold_inr: v })} /></Field>
        <Field label="Discord webhook">
          <input value={s.discord_webhook_url ?? ""} onChange={(e) => set({ discord_webhook_url: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="AI behaviour">
          <input value={s.ai_behaviour ?? ""} onChange={(e) => set({ ai_behaviour: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.auto_ordering_enabled} onChange={(e) => set({ auto_ordering_enabled: e.target.checked })} /> Auto ordering enabled</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.email_alerts_enabled} onChange={(e) => set({ email_alerts_enabled: e.target.checked })} /> Email alerts</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.telegram_alerts_enabled} onChange={(e) => set({ telegram_alerts_enabled: e.target.checked })} /> Telegram alerts</label>
      </div>

      <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--neon)]/15 px-4 py-2 text-sm font-semibold text-[var(--neon)] disabled:opacity-50">
        <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
      </button>

      <SocialLinksEditor />
    </div>
  );
}

type SocialRow = {
  id: string;
  key: string;
  label: string;
  url: string;
  emoji: string;
  description: string;
  sort_order: number;
  active: boolean;
};

function SocialLinksEditor() {
  const [rows, setRows] = useState<SocialRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("social_links").select("*").order("sort_order");
    setRows((data ?? []) as SocialRow[]);
  };

  useEffect(() => { void load(); }, []);

  const patch = (id: string, p: Partial<SocialRow>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const saveRow = async (row: SocialRow) => {
    setBusy(true);
    const { id, ...rest } = row;
    const { error } = await supabase.from("social_links").update(rest).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${row.label} saved`);
  };

  const addRow = async () => {
    const key = window.prompt("Short key (e.g. discord)")?.trim().toLowerCase();
    if (!key) return;
    const { error } = await supabase.from("social_links").insert({
      key, label: key, url: "https://", emoji: "🔗", description: "", sort_order: rows.length + 1,
    });
    if (error) return toast.error(error.message);
    void load();
  };

  const removeRow = async (id: string) => {
    const { error } = await supabase.from("social_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">Official links</h3>
          <p className="text-xs text-muted-foreground">Shown as buttons by Fatui AI when customers ask for your website or socials.</p>
        </div>
        <button onClick={() => void addRow()} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">Add link</button>
      </div>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="surface-card grid gap-2 p-3 sm:grid-cols-[5rem_1fr_1fr_5rem_auto] sm:items-center">
            <input value={r.emoji} onChange={(e) => patch(r.id, { emoji: e.target.value })} placeholder="🔗" className="rounded-lg border border-input bg-background px-2 py-2 text-sm" />
            <input value={r.label} onChange={(e) => patch(r.id, { label: e.target.value })} placeholder="Label" className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <input value={r.url} onChange={(e) => patch(r.id, { url: e.target.value })} placeholder="https://" className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <input type="number" value={r.sort_order} onChange={(e) => patch(r.id, { sort_order: Number(e.target.value) })} className="rounded-lg border border-input bg-background px-2 py-2 text-sm" />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.active} onChange={(e) => patch(r.id, { active: e.target.checked })} /> Live</label>
              <button onClick={() => void saveRow(r)} disabled={busy} className="rounded-lg bg-[var(--neon)]/15 px-3 py-2 text-xs font-semibold text-[var(--neon)] disabled:opacity-50">Save</button>
              <button onClick={() => void removeRow(r.id)} className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive">Delete</button>
            </div>
            <input value={r.description} onChange={(e) => patch(r.id, { description: e.target.value })} placeholder="Short description" className="rounded-lg border border-input bg-background px-3 py-2 text-xs sm:col-span-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
    />
  );
}
