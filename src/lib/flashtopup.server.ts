/**
 * FlashTopup reseller API client (server-only).
 *
 * Auth: HMAC-SHA256 over the canonical string
 *   METHOD\n/api/reseller/v2/<path>\n<unix_ts>\n<nonce>\n<sha256_hex(raw_body)>
 * signed with the API key. Credentials are read inside the call, never at
 * module scope, and never reach the browser.
 */

const BASE_PATH = "/api/reseller/v2";
const BASE_URL = `https://api.flashtopup.com${BASE_PATH}`;

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sha256Hex(text: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function hmacHex(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
}

export async function flashtopupRequest<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const apiId = process.env["FLASHTOPUP_API_ID"];
  const apiKey = process.env["FLASHTOPUP_API_KEY"];
  if (!apiId || !apiKey) throw new Error("FlashTopup is not configured");

  const method = options.method ?? "GET";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const rawBody = options.body === undefined ? "" : JSON.stringify(options.body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  // Only the path is signed — never the query string or full URL.
  const canonical = [method, `${BASE_PATH}${cleanPath}`, timestamp, nonce, await sha256Hex(rawBody)].join("\n");
  const signature = await hmacHex(apiKey, canonical);

  const qs = options.query ? `?${new URLSearchParams(options.query).toString()}` : "";
  const res = await fetch(`${BASE_URL}${cleanPath}${qs}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-FT-API-ID": apiId,
      "X-FT-Timestamp": timestamp,
      "X-FT-Nonce": nonce,
      "X-FT-Signature": signature,
    },
    ...(rawBody ? { body: rawBody } : {}),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    console.error("[flashtopup] request failed", { path: cleanPath, status: res.status, body: text.slice(0, 500) });
    throw new Error(json?.message || `FlashTopup API error (${res.status})`);
  }
  return json as T;
}

export type NormalizedSupplierProduct = {
  product_code: string;
  name: string;
  product_type: string | null;
  icon_url: string | null;
  validation_code: string | null;
  raw: Record<string, unknown>;
};

const pick = (row: Record<string, any>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = row?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
};

/** Pulls the product array out of whatever envelope the API returns. */
export function extractProductList(payload: any): Record<string, any>[] {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", "products", "result", "items"]) {
    const v = payload?.[key];
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.products)) return v.products;
    if (v && Array.isArray(v.data)) return v.data;
  }
  return [];
}

/** Maps a raw supplier row onto our columns, tolerating naming variations. */
export function normalizeProduct(row: Record<string, any>): NormalizedSupplierProduct | null {
  const code = pick(row, ["product_code", "productCode", "code", "sku", "id"]);
  if (!code) return null;
  return {
    product_code: code,
    name: pick(row, ["product_name", "productName", "name", "title"]) ?? code,
    product_type: pick(row, ["product_type", "productType", "type", "category"]),
    icon_url: pick(row, ["icon", "icon_url", "iconUrl", "image", "image_url", "logo"]),
    validation_code: pick(row, ["validation_code", "validationCode", "validate_code", "validation"]),
    raw: row,
  };
}
