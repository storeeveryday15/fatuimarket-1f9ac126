import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { SUPPLIER_STATUS_META, type Supplier } from "@/lib/admin/types";
import { checkSupplier } from "@/lib/admin.functions";
import { RefreshCw, Plus, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/suppliers")({ component: SuppliersPage });

const BLANK = {
  name: "", website: "", api_endpoint: "", priority: 100,
  supported_products: "", notes: "", auto_pricing_enabled: false, auto_ordering_enabled: false,
};

function SuppliersPage() {
  const { rows, loading } = useRealtimeTable<Supplier>("suppliers", { orderBy: "priority", ascending: true });
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState<string | null>(null);

  const openNew = () => { setForm({ ...BLANK }); setEditing(null); setCreating(true); };
  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name, website: s.website ?? "", api_endpoint: s.api_endpoint ?? "", priority: s.priority,
      supported_products: (s.supported_products ?? []).join(", "), notes: s.notes ?? "",
      auto_pricing_enabled: s.auto_pricing_enabled, auto_ordering_enabled: s.auto_ordering_enabled,
    });
    setEditing(s); setCreating(true);
  };

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      website: form.website.trim() || null,
      api_endpoint: form.api_endpoint.trim() || null,
      priority: Number(form.priority) || 100,
      supported_products: form.supported_products.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes.trim() || null,
      auto_pricing_enabled: form.auto_pricing_enabled,
      auto_ordering_enabled: form.auto_ordering_enabled,
    };
    if (!payload.name) return toast.error("Supplier name is required");
    const { error } = editing
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Supplier updated" : "Supplier added");
    setCreating(false);
  };

  const remove = async (s: Supplier) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Supplier deleted");
  };

  const runCheck = async (s: Supplier) => {
    setBusy(s.id);
    try {
      const res = await checkSupplier({ data: { supplier_id: s.id } });
      toast.success(`${s.name}: ${res.status.replace("_", " ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check failed");
    } finally { setBusy(null); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Suppliers</h2>
          <p className="text-xs text-muted-foreground">
            Health checks only run against official APIs you configure. Suppliers without an API stay manual.
          </p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Add supplier
        </button>
      </div>

      {loading && <div className="surface-card p-10 text-center text-sm text-muted-foreground">Loading suppliers…</div>}

      <div className="grid gap-3">
        {(rows ?? []).map((s) => {
          const meta = SUPPLIER_STATUS_META[s.status] ?? SUPPLIER_STATUS_META.unknown;
          return (
            <div key={s.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.className}`}>{meta.label}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">Priority {s.priority}</span>
                  </div>
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--neon)] hover:underline">
                      {s.website.replace(/^https?:\/\//, "").slice(0, 60)} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Last checked: {s.last_checked_at ? new Date(s.last_checked_at).toLocaleString() : "never"} · Avg response:{" "}
                    {s.avg_response_ms ? `${s.avg_response_ms} ms` : "—"} · Errors: {s.error_count}
                  </div>
                  {s.supported_products?.length > 0 && (
                    <div className="mt-1 text-[11px] text-muted-foreground">Products: {s.supported_products.join(", ")}</div>
                  )}
                  {s.notes && <div className="mt-1 text-xs">{s.notes}</div>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button disabled={busy === s.id} onClick={() => runCheck(s)} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] hover:bg-secondary disabled:opacity-50">
                    <RefreshCw className={`h-3 w-3 ${busy === s.id ? "animate-spin" : ""}`} /> Check
                  </button>
                  <button onClick={() => openEdit(s)} className="rounded-md border border-border px-2.5 py-1.5 text-[11px] hover:bg-secondary">Edit</button>
                  <button onClick={() => remove(s)} className="rounded-md bg-destructive/15 px-2.5 py-1.5 text-[11px] font-semibold text-destructive">Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setCreating(false)}>
          <div className="flex-1 bg-black/50" />
          <div className="h-full w-full max-w-lg overflow-y-auto bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold">{editing ? "Edit supplier" : "New supplier"}</div>
            <div className="mt-4 grid gap-3">
              <Field label="Name"><input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Website"><input className="inp" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
              <Field label="API endpoint (optional)"><input className="inp" value={form.api_endpoint} onChange={(e) => setForm({ ...form, api_endpoint: e.target.value })} /></Field>
              <Field label="Priority"><input type="number" className="inp" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></Field>
              <Field label="Supported products (comma separated slugs)"><input className="inp" value={form.supported_products} onChange={(e) => setForm({ ...form, supported_products: e.target.value })} /></Field>
              <Field label="Notes"><textarea rows={3} className="inp" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.auto_pricing_enabled} onChange={(e) => setForm({ ...form, auto_pricing_enabled: e.target.checked })} /> Auto pricing enabled</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.auto_ordering_enabled} onChange={(e) => setForm({ ...form, auto_ordering_enabled: e.target.checked })} /> Auto ordering enabled (requires official API)</label>
              <p className="text-[11px] text-muted-foreground">API keys are stored as encrypted backend secrets, never in the database.</p>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={save} className="rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
              <button onClick={() => setCreating(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1 [&_.inp]:w-full [&_.inp]:rounded-lg [&_.inp]:border [&_.inp]:border-input [&_.inp]:bg-background [&_.inp]:px-3 [&_.inp]:py-2 [&_.inp]:text-sm">{children}</div>
    </div>
  );
}
