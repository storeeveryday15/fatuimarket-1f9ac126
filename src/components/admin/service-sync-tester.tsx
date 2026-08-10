import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { testProductServices, type ServiceSyncTestResult } from "@/lib/flashtopup.functions";

/**
 * Admin diagnostic: runs a single-product /services sync and shows exactly
 * what landed in the database. Defaults to TOPUP_MOBILE_LEGENDS / topup.
 */
export function ServiceSyncTester() {
  const [productCode, setProductCode] = useState("TOPUP_MOBILE_LEGENDS");
  const [productType, setProductType] = useState("topup");
  const [result, setResult] = useState<ServiceSyncTestResult | null>(null);
  const run = useServerFn(testProductServices);

  const mutation = useMutation({
    mutationFn: () => run({ data: { productCode: productCode.trim(), productType: productType.trim() || null } }),
    onSuccess: (res) => {
      setResult(res);
      if (res.ok) toast.success(`${res.inserted} package(s) synced — ${res.rowsInDb} live in the database`);
      else toast.error(res.message ?? "Service sync failed");
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Service sync failed"),
  });

  const field =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <section className="surface-card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Test service sync</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <label className="space-y-1 text-xs text-muted-foreground">
          Product code
          <input className={field} value={productCode} onChange={(e) => setProductCode(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Product type
          <input className={field} value={productType} onChange={(e) => setProductType(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !productCode.trim()}
          className="btn-shine rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Testing…" : "Run test"}
        </button>
      </div>

      {result && (
        <div className="space-y-3 rounded-md border border-border p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label="Status" value={result.ok ? "OK" : `Failed${result.status ? ` (${result.status})` : ""}`} />
            <Stat label="Fetched" value={String(result.fetched)} />
            <Stat label="Upserted" value={String(result.inserted)} />
            <Stat label="Live in DB" value={String(result.rowsInDb)} />
          </div>
          {result.message && (
            <p className="text-xs text-destructive">
              {result.errorCode ? `${result.errorCode}: ` : ""}
              {result.message}
            </p>
          )}
          {result.sample.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {result.sample.map((s) => (
                <li key={s.service_code} className="flex justify-between gap-3">
                  <span className="truncate">
                    {s.service_name} <span className="opacity-60">({s.service_code})</span>
                  </span>
                  <span>
                    {s.sell_price_inr != null ? `₹${s.sell_price_inr}` : "—"} · {s.available ? "available" : "unavailable"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
