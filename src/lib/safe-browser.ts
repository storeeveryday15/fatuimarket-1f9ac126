/**
 * Defensive browser-API helpers.
 *
 * Older Android Chrome / WebView builds and browsers with "block third-party
 * cookies and site data" enabled behave differently from desktop Chrome:
 *   - reading `window.localStorage` can THROW a SecurityError (not return null)
 *   - `crypto.randomUUID` does not exist before Chrome 92
 * Both used to throw during render and tripped the root error boundary, which
 * is why some phones saw "This page didn't load" on every page.
 */

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

const fallbackLocal = memoryStorage();
const fallbackSession = memoryStorage();

function pick(kind: "local" | "session"): StorageLike {
  if (typeof window === "undefined") return kind === "local" ? fallbackLocal : fallbackSession;
  try {
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__fm_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return kind === "local" ? fallbackLocal : fallbackSession;
  }
}

/** localStorage that never throws — falls back to in-memory storage. */
export const safeLocalStorage: StorageLike = {
  getItem: (k) => {
    try {
      return pick("local").getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      pick("local").setItem(k, v);
    } catch {
      /* quota or blocked storage — non-fatal */
    }
  },
  removeItem: (k) => {
    try {
      pick("local").removeItem(k);
    } catch {
      /* non-fatal */
    }
  },
};

/** sessionStorage that never throws — falls back to in-memory storage. */
export const safeSessionStorage: StorageLike = {
  getItem: (k) => {
    try {
      return pick("session").getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      pick("session").setItem(k, v);
    } catch {
      /* non-fatal */
    }
  },
  removeItem: (k) => {
    try {
      pick("session").removeItem(k);
    } catch {
      /* non-fatal */
    }
  },
};

/** True when persistent storage is actually usable in this browser. */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem("__fm_probe__", "1");
    window.localStorage.removeItem("__fm_probe__");
    return true;
  } catch {
    return false;
  }
}

/** RFC4122-shaped id that works without crypto.randomUUID (Chrome < 92). */
export function safeUUID(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    if (c && typeof c.getRandomValues === "function") {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const hex = Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    /* fall through to Math.random */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Clipboard write with a legacy execCommand fallback for old WebViews. */
export async function safeCopy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
