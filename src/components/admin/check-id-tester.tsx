import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bug, CheckCircle2, XCircle, Search } from "lucide-react";
import { testCheckId, listCheckIdProducts } from "@/lib/flashtopup.functions";

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

function prettyJson(raw: string): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Android / iOS hint taken from the supplier's own product name or code. */
function platformOf(name: string, code: string): string | null {
  const s = `${name} ${code}`.toLowerCase();
  if (/\bios\b|iphone|apple/.test(s)) return "iOS";
  if (/android|google play/.test(s)) return "Android";
  return null;
}

const TYPE_LABEL: Record<string, string> = { topup: "Top-ups", giftcard: "Gift cards", voucher: "Vouchers" };

/** Admin-only debugging panel for the FlashTopup Check-ID endpoint. */
export function CheckIdTester() {
  const run = useServerFn(testCheckId);
  const list = useServerFn(listCheckIdProducts);
  const { data: products = [], isLoading } = useQuery({ queryKey: ["check-id-products"], queryFn: () => list() });

  const [q, setQ] = useState("");
  const [onlySupported, setOnlySupported] = useState(true);
  const [productId, setProductId] = useState("");
  const [userId, setUserId] = useState("");
  const [serverId, setServerId] = useState("");

  const selected = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (onlySupported && !p.requirement.supported) return false;
      if (!term) return true;
      return `${p.name} ${p.product_code} ${p.region ?? ""} ${p.requirement.validationCode ?? ""}`.toLowerCase().includes(term);
    });
    const map = new Map<string, typeof filtered>();
    for (const p of filtered) {
      const key = TYPE_LABEL[p.product_type ?? ""] ?? "Other";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [products, q, onlySupported]);

  const userField = selected?.requirement.fields.find((f) => f.role === "user");
  const serverField = selected?.requirement.fields.find((f) => f.role === "server");

  const mutation = useMutation({
    mutationFn: () =>
      run({ data: { supplierProductId: productId, userId: userId.trim(), serverId: serverId.trim() || null } }),
  });
  const result = mutation.data;

  return (
    <section className="surface-card mt-6 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Bug className="h-4 w-4 text-[var(--neon)]" />
        <h2 className="text-sm font-bold uppercase tracking-wider">Test Check-ID</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick a supplier game. The validation code and required fields come from the supplier's own product definition.
        Runs a live player check only — no order is placed. Credentials are never shown.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search game, region, product code…"
            aria-label="Search supplier games"
            className={`${field} pl-9`}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={onlySupported} onChange={(e) => setOnlySupported(e.target.checked)} />
          Only games with Check-ID
        </label>
      </div>

      <select
        value={productId}
        onChange={(e) => {
          setProductId(e.target.value);
          setServerId("");
          mutation.reset();
        }}
        aria-label="Supplier game"
        size={8}
        className={`${field} mt-3`}
      >
        {isLoading && <option disabled>Loading games…</option>}
        {groups.map(([label, items]) => (
          <optgroup key={label} label={`${label} (${items.length})`}>
            {items.map((p) => {
              const platform = platformOf(p.name, p.product_code);
              return (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.region ? ` · ${p.region}` : ""}
                  {platform ? ` · ${platform}` : ""} — {p.requirement.supported ? p.requirement.validationCode : "no Check-ID"}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>

      {selected && (
        <div className="mt-3 rounded-lg border border-border p-3 text-xs">
          <p>
            <strong>{selected.name}</strong> <span className="font-mono text-muted-foreground">{selected.product_code}</span>
          </p>
          {selected.requirement.supported ? (
            <p className="mt-1 text-muted-foreground">
              Check-ID supported · validation code{" "}
              <span className="font-mono text-foreground">{selected.requirement.validationCode}</span> · required:{" "}
              {selected.requirement.fields.filter((f) => f.required).map((f) => f.label).join(", ") || "none listed"}
              {selected.requirement.unsupportedFields.length > 0 &&
                ` · extra fields not sent by Check-ID: ${selected.requirement.unsupportedFields.join(", ")}`}
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground">{selected.requirement.reason}</p>
          )}
        </div>
      )}

      {selected?.requirement.supported && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder={userField?.placeholder ?? userField?.label ?? "Player / user ID"}
            aria-label={userField?.label ?? "Player ID"}
            className={field}
          />
          {selected.requirement.needsServer && (
            <input
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              placeholder={serverField?.placeholder ?? serverField?.label ?? "Server / zone ID"}
              aria-label={serverField?.label ?? "Server ID"}
              className={field}
            />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={
          mutation.isPending ||
          !selected?.requirement.supported ||
          !userId.trim() ||
          (selected.requirement.needsServer && !serverId.trim())
        }
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-foreground/30 disabled:opacity-60"
      >
        <Bug className={`h-4 w-4 ${mutation.isPending ? "animate-pulse" : ""}`} />
        {mutation.isPending ? "Testing…" : "Test Check-ID"}
      </button>

      {mutation.error && <p className="mt-3 text-xs text-destructive">{(mutation.error as Error).message}</p>}

      {result && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
                result.ok ? "bg-[var(--neon)]/15 text-[var(--neon)]" : "bg-destructive/15 text-destructive"
              }`}
            >
              {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {result.ok ? "Verified" : result.supported ? "Failed" : "Not supported"}
            </span>
            <span className="text-muted-foreground">HTTP {result.status ?? "—"}</span>
            {result.nickname && (
              <span>
                Nickname: <strong>{result.nickname}</strong>
              </span>
            )}
            {result.validationCode && (
              <span className="text-muted-foreground">
                Code {result.validationCode} (from {result.validationSource})
              </span>
            )}
          </div>
          {result.message && <p className="text-muted-foreground">Message: {result.message}</p>}
          {result.trace && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Request</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-background/60 p-3 font-mono text-[11px]">
                  {JSON.stringify(
                    {
                      method: result.trace.method,
                      url: result.trace.url,
                      signedPath: result.trace.signedPath,
                      headers: result.trace.headers,
                      body: result.trace.requestBody,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
                  Response · {result.trace.durationMs}ms
                </p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-background/60 p-3 font-mono text-[11px]">
                  {prettyJson(result.trace.rawResponse) || result.trace.error || "(empty)"}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
