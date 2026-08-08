import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bug, CheckCircle2, XCircle } from "lucide-react";
import { testCheckId } from "@/lib/flashtopup.functions";

type Service = {
  id: string;
  service_name: string;
  service_code: string;
  validation_code: string | null;
  requires_validation: boolean;
  input_fields: string[];
};

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

/** Admin-only debugging panel for the FlashTopup Check-ID endpoint. */
export function CheckIdTester({ services }: { services: Service[] }) {
  const run = useServerFn(testCheckId);
  const [serviceId, setServiceId] = useState("");
  const [validationCode, setValidationCode] = useState("");
  const [userId, setUserId] = useState("");
  const [serverId, setServerId] = useState("");

  const selected = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId]);

  const mutation = useMutation({
    mutationFn: () =>
      run({
        data: {
          serviceId: serviceId || null,
          validationCode: validationCode.trim() || null,
          userId: userId.trim(),
          serverId: serverId.trim() || null,
        },
      }),
  });

  const result = mutation.data;

  return (
    <section className="surface-card mt-6 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Bug className="h-4 w-4 text-[var(--neon)]" />
        <h2 className="text-sm font-bold uppercase tracking-wider">Test Check-ID</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Runs a live Check-ID call and shows the exact request, HTTP status and supplier response. Credentials are never
        included.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          aria-label="Supplier service"
          className={field}
        >
          <option value="">Manual validation code…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.service_name} ({s.service_code})
            </option>
          ))}
        </select>
        <input
          value={selected ? (selected.validation_code ?? "—") : validationCode}
          onChange={(e) => setValidationCode(e.target.value)}
          disabled={Boolean(selected)}
          placeholder="Validation code"
          aria-label="Validation code"
          className={`${field} disabled:opacity-60`}
        />
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Player / user ID"
          aria-label="Player user ID"
          className={field}
        />
        <input
          value={serverId}
          onChange={(e) => setServerId(e.target.value)}
          placeholder="Server / zone ID (optional)"
          aria-label="Server or zone ID"
          className={field}
        />
      </div>

      {selected && (
        <p className="mt-2 text-xs text-muted-foreground">
          Required inputs: {selected.input_fields.length ? selected.input_fields.join(", ") : "none reported"} ·
          validation {selected.requires_validation ? "required" : "not required"}
        </p>
      )}

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !userId.trim()}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-foreground/30 disabled:opacity-60"
      >
        <Bug className={`h-4 w-4 ${mutation.isPending ? "animate-pulse" : ""}`} />
        {mutation.isPending ? "Testing…" : "Test Check-ID"}
      </button>

      {mutation.error && (
        <p className="mt-3 text-xs text-destructive">{(mutation.error as Error).message}</p>
      )}

      {result && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
                result.ok ? "bg-[var(--neon)]/15 text-[var(--neon)]" : "bg-destructive/15 text-destructive"
              }`}
            >
              {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {result.ok ? "Verified" : "Failed"}
            </span>
            <span className="text-muted-foreground">HTTP {result.status ?? "—"}</span>
            {result.nickname && <span>Nickname: <strong>{result.nickname}</strong></span>}
            {result.service && (
              <span className="text-muted-foreground">
                Validation code {result.matchesService ? "matches" : "does NOT match"} the selected service
              </span>
            )}
            {result.missingFields.length > 0 && (
              <span className="text-destructive">Missing required inputs: {result.missingFields.join(", ")}</span>
            )}
          </div>

          {result.message && <p className="text-muted-foreground">Supplier message: {result.message}</p>}

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
                  {result.trace.responseBody
                    ? JSON.stringify(result.trace.responseBody, null, 2)
                    : result.trace.rawResponse || result.trace.error || "(empty)"}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
