/**
 * Client-side resilience installed once from the root route.
 *
 * 1. Repairs `window.localStorage` when the browser throws on access, so
 *    third-party libraries (e.g. the auth client) that read it directly do not
 *    crash the whole app on privacy-restricted Android browsers.
 * 2. Reports uncaught errors and rejected promises so production issues are
 *    visible instead of silently rendering the error screen.
 * 3. Recovers from stale bundle references after a deployment: when a lazily
 *    loaded chunk 404s because the old hashed file is gone, reload once with a
 *    cache-busting query instead of showing an error page.
 */

import { reportLovableError } from "./lovable-error-reporting";

const RELOAD_FLAG = "__fm_chunk_reloaded";

function repairStorage() {
  const shim = (): Storage => {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      removeItem: (k: string) => void map.delete(k),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
    } as Storage;
  };

  for (const name of ["localStorage", "sessionStorage"] as const) {
    let broken = false;
    try {
      const store = window[name];
      store.setItem("__fm_probe__", "1");
      store.removeItem("__fm_probe__");
    } catch {
      broken = true;
    }
    if (!broken) continue;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        get: (() => {
          const s = shim();
          return () => s;
        })(),
      });
      console.warn(`[fatui] ${name} is blocked by this browser — using in-memory fallback.`);
    } catch {
      /* nothing else we can do */
    }
  }
}

function isStaleChunkError(message: string) {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

/** Reload once against fresh assets when a deployment invalidated the bundle. */
export function recoverFromStaleAssets(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  if (!isStaleChunkError(message)) return false;
  try {
    if (window.sessionStorage.getItem(RELOAD_FLAG)) return false;
    window.sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    /* storage blocked — still worth one reload attempt below */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString(36));
  window.location.replace(url.toString());
  return true;
}

let installed = false;

export function installClientResilience() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  repairStorage();

  try {
    window.sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }

  window.addEventListener("error", (event) => {
    const err = event.error ?? event.message;
    if (recoverFromStaleAssets(err)) return;
    // Cross-origin ad/analytics scripts surface as a bare "Script error." with
    // no stack — they are not app faults, so don't report them as such.
    if (!event.error && event.message === "Script error.") return;
    console.error("[fatui] uncaught error", err);
    reportLovableError(err, { source: "window.onerror", filename: event.filename });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (recoverFromStaleAssets(reason)) return;
    console.error("[fatui] unhandled rejection", reason);
    reportLovableError(reason, { source: "unhandledrejection" });
  });
}
