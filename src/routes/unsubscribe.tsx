import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe — Fatui Market" },
      { name: "description", content: "Stop receiving Fatui Market announcement emails." },
      { property: "og:title", content: "Unsubscribe — Fatui Market" },
      { property: "og:description", content: "Manage your Fatui Market email preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
  errorComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">Something went wrong. Please try again later.</p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-sm text-muted-foreground">Page not found.</p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="surface-card w-full space-y-4 p-8">
        <h1 className="text-lg font-bold">Email preferences</h1>
        {children}
      </div>
    </main>
  );
}

type State = "loading" | "ready" | "done" | "already" | "invalid";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) return setState("invalid");
    void (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`);
        const data = (await res.json()) as { valid?: boolean; reason?: string };
        if (data.valid) setState("ready");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, []);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { success?: boolean; reason?: string };
      setState(data.success ? "done" : data.reason === "already_unsubscribed" ? "already" : "invalid");
    } catch {
      setState("invalid");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      {state === "loading" && <p className="text-sm text-muted-foreground">Checking your link…</p>}
      {state === "ready" && (
        <>
          <p className="text-sm text-muted-foreground">
            Unsubscribe from Fatui Market announcement emails? Order updates required for your
            purchases will still be sent.
          </p>
          <button
            onClick={() => void confirm()}
            disabled={busy}
            className="w-full rounded-lg bg-[var(--neon)]/15 px-4 py-2 text-sm font-semibold text-[var(--neon)] disabled:opacity-50"
          >
            {busy ? "Processing…" : "Confirm unsubscribe"}
          </button>
        </>
      )}
      {state === "done" && (
        <p className="text-sm text-muted-foreground">
          You've been unsubscribed. You won't receive marketing or announcement emails from us.
        </p>
      )}
      {state === "already" && (
        <p className="text-sm text-muted-foreground">You're already unsubscribed.</p>
      )}
      {state === "invalid" && (
        <p className="text-sm text-muted-foreground">
          This unsubscribe link is invalid or expired.
        </p>
      )}
      <a href="/" className="block text-xs text-muted-foreground underline">
        Back to Fatui Market
      </a>
    </Shell>
  );
}
